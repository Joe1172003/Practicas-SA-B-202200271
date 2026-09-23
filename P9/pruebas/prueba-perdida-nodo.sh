#!/usr/bin/env bash
# Prueba de perdida de nodo.
#
# Drena un nodo (lo vacia como si se hubiera muerto) mientras un bucle golpea
# el gateway una vez por segundo y anota cada respuesta con su hora. Al final
# cuenta cuantas peticiones fallaron.
#
# Lo que sostiene el servicio durante el drenaje:
#   - 2 replicas por servicio,
#   - anti-afinidad, que las reparte en nodos distintos,
#   - PodDisruptionBudget, que impide sacar la ultima replica viva.
#
# Requisitos: kubectl apuntando al cluster y curl.
set -uo pipefail

NS="${NS:-sa-p8}"
HOST="${HOST:-136.113.9.71.nip.io}"
IP="${IP:-136.113.9.71}"
SELLO="$(date -u +%Y%m%d-%H%M%S)"
REGISTRO="/tmp/peticiones-$SELLO.txt"

marca() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
paso() { echo; echo "===== $(marca)  $*"; }

echo "Prueba de perdida de nodo - $(marca)"

paso "1. Reparto de Pods por nodo"
kubectl -n "$NS" get pods -o custom-columns=POD:.metadata.name,NODO:.spec.nodeName --no-headers |
  grep -v -E "bitacora|resumen" | sort -k2

# Que nodo drenar. Por defecto, el de postgres: es el caso mas duro, porque la
# base tiene una sola replica y hay que moverla con su disco. Se puede pasar
# otro nodo como primer argumento:
#   bash prueba-perdida-nodo.sh gke-sa-p9-principal-xxxx
NODO="${1:-$(kubectl -n "$NS" get pod postgres-0 -o jsonpath='{.spec.nodeName}')}"
echo
echo "  Nodo elegido: $NODO"

paso "2. Arranco el trafico (1 vuelta por segundo)"
# Dos mediciones por vuelta:
#   /health            -> solo el gateway, no toca la base.
#   /graphql/productos -> gateway + productos + postgres, la cadena completa.
# El tiempo lo mide el propio curl, asi no hace falta bc (Git Bash no lo trae).
(
  while true; do
    salud=$(curl -s -o /dev/null -m 5 -w "%{http_code}" -H "Host: $HOST" "http://$IP/health" 2>/dev/null)
    lectura=$(curl -s -o /dev/null -m 5 -w "%{http_code} %{time_total}" -X POST -H "Host: $HOST"       -H "Content-Type: application/json" -d '{"query":"{ productos { nombre } }"}'       "http://$IP/graphql/productos" 2>/dev/null)
    catalogo=${lectura%% *}
    demora=${lectura##* }
    printf "%s salud=%s catalogo=%s %ss
" "$(marca)" "${salud:-000}" "${catalogo:-000}" "${demora:-0}" >> "$REGISTRO"
    sleep 1
  done
) &
BUCLE=$!
trap 'kill $BUCLE 2>/dev/null' EXIT
sleep 10

paso "3. Drenaje del nodo $NODO"
T_INICIO=$(marca)
kubectl drain "$NODO" --ignore-daemonsets --delete-emptydir-data --timeout=600s
T_DRENADO=$(marca)

paso "4. Espero a que los Pods se reacomoden en los otros nodos"
kubectl -n "$NS" wait --for=condition=ready pod -l app.kubernetes.io/name=gateway --timeout=300s
kubectl -n "$NS" get pods -o custom-columns=POD:.metadata.name,NODO:.spec.nodeName,LISTO:.status.containerStatuses[0].ready --no-headers |
  grep -v -E "bitacora|resumen" | sort -k2

paso "5. Devuelvo el nodo al servicio"
kubectl uncordon "$NODO"
T_FIN=$(marca)
sleep 10

kill $BUCLE 2>/dev/null

paso "6. Resultado del trafico"
TOTAL=$(wc -l < "$REGISTRO")
SALUD_OK=$(grep -c "salud=200" "$REGISTRO")
CAT_OK=$(grep -c "catalogo=200" "$REGISTRO")
echo "  Vueltas totales:            $TOTAL"
echo "  /health con 200:            $SALUD_OK  (fallas: $((TOTAL - SALUD_OK)))"
echo "  /graphql/productos con 200: $CAT_OK  (fallas: $((TOTAL - CAT_OK)))"
if [ "$((TOTAL - SALUD_OK + TOTAL - CAT_OK))" -gt 0 ]; then
  echo
  echo "  Momentos con alguna falla:"
  grep -v "salud=200 catalogo=200" "$REGISTRO" | sed 's/^/    /'
fi
echo
echo "  Vuelta mas lenta: $(awk '{gsub(/s$/,"",$4); if ($4+0 > max) max=$4+0} END {printf "%.2f s", max}' "$REGISTRO")"
echo
echo "  Inicio del drenaje:  $T_INICIO"
echo "  Nodo vaciado:        $T_DRENADO"
echo "  Nodo devuelto:       $T_FIN"

DESTINO="$(cd "$(dirname "$0")/../evidencias" && pwd)"
cp "$REGISTRO" "$DESTINO/peticiones-$SELLO.txt" 2>/dev/null
echo
echo "  Registro completo: evidencias/peticiones-$SELLO.txt"
