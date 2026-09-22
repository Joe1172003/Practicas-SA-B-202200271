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

# El nodo con mas Pods del gateway es el que mas duele perder.
NODO=$(kubectl -n "$NS" get pods -l app.kubernetes.io/name=gateway \
  -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
echo
echo "  Nodo elegido: $NODO"

paso "2. Arranco el trafico contra el gateway (1 peticion por segundo)"
(
  while true; do
    inicio=$(date +%s.%N)
    codigo=$(curl -s -o /dev/null -m 5 -w "%{http_code}" -H "Host: $HOST" "http://$IP/health" 2>/dev/null)
    fin=$(date +%s.%N)
    printf "%s %s %.0fms\n" "$(marca)" "${codigo:-000}" "$(echo "($fin - $inicio) * 1000" | bc)" >> "$REGISTRO"
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
OK=$(grep -c " 200 " "$REGISTRO")
FALLAS=$((TOTAL - OK))
echo "  Peticiones totales: $TOTAL"
echo "  Respuestas 200:     $OK"
echo "  Fallas:             $FALLAS"
if [ "$FALLAS" -gt 0 ]; then
  echo
  echo "  Detalle de las fallas:"
  grep -v " 200 " "$REGISTRO" | sed 's/^/    /'
fi
echo
echo "  Peticion mas lenta: $(awk '{gsub(/ms/,"",$3); if ($3+0 > max) max=$3+0} END {print max"ms"}' "$REGISTRO")"
echo
echo "  Inicio del drenaje:  $T_INICIO"
echo "  Nodo vaciado:        $T_DRENADO"
echo "  Nodo devuelto:       $T_FIN"

cp "$REGISTRO" "./peticiones-$SELLO.txt" 2>/dev/null
echo
echo "  Registro completo: peticiones-$SELLO.txt"
