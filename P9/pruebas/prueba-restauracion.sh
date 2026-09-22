#!/usr/bin/env bash
# Prueba de restauracion de datos con Velero.
#
# Que demuestra:
#   1. Que el respaldo trae datos reales y no un disco vacio.
#   2. Cuanto se pierde de verdad (el RPO medido): lo escrito despues del
#      ultimo respaldo no vuelve.
#   3. Cuanto tarda la recuperacion de datos.
#
# Como lo hace sin pelearse con ArgoCD: restaura el postgres del respaldo en un
# namespace aparte (sa-p8-restaurado), comprueba ahi el contenido y recien
# despues devuelve los datos a produccion. ArgoCD sigue mandando en sa-p8 todo
# el tiempo.
#
# Requisitos: kubectl apuntando al cluster, velero en el PATH y gcloud con
# sesion iniciada.
set -uo pipefail

NS="${NS:-sa-p8}"
NS_TEMP="${NS_TEMP:-sa-p8-restaurado}"
BD="db_productos"
SELLO="$(date -u +%Y%m%d-%H%M%S)"
RESPALDO="prueba-dr-$SELLO"

marca() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
paso() { echo; echo "===== $(marca)  $*"; }

# La consulta entra por stdin y no como argumento: asi el SQL puede llevar
# comillas sin pelearse con las del shell.
sql() {
  local ns="$1" consulta="$2"
  kubectl -n "$ns" exec -i postgres-0 -- sh -c \
    "PGPASSWORD=\$POSTGRES_PASSWORD psql -U \$POSTGRES_USER -d $BD -At" <<< "$consulta" 2>/dev/null | tr -d '\r'
}

# Un snapshot de GCP tarda un rato en quedar READY. Si se restaura antes,
# Google responde "resourceNotReady" y la restauracion queda PartiallyFailed.
esperar_snapshots() {
  local intentos=60
  while [ $intentos -gt 0 ]; do
    local pendientes
    pendientes=$(gcloud compute snapshots list --filter="status!=READY" --format="value(name)" 2>/dev/null | wc -l)
    [ "$pendientes" -eq 0 ] && { echo "  todos los snapshots estan READY"; return 0; }
    echo "  esperando $pendientes snapshot(s)..."
    sleep 10
    intentos=$((intentos - 1))
  done
  echo "  AVISO: algun snapshot sigue sin estar READY"
}

echo "Prueba de restauracion de datos - $(marca)"
echo "Respaldo: $RESPALDO   Namespace: $NS   Namespace temporal: $NS_TEMP"

paso "1. Estado inicial del catalogo"
echo "  productos: $(sql "$NS" 'select count(*) from productos;')"
sql "$NS" "select '  - ' || nombre || ' | Q' || precio from productos order by nombre;"

paso "2. Escribo un producto que SI tiene que sobrevivir (entra antes del respaldo)"
CAT=$(sql "$NS" 'select id from categorias order by nombre limit 1;')
sql "$NS" "insert into productos (nombre, descripcion, precio, stock_disponible, categoria_id) values ('ANTES DEL RESPALDO $SELLO', 'Prueba de DR', 111.11, 7, '$CAT');" >/dev/null
echo "  productos ahora: $(sql "$NS" 'select count(*) from productos;')"

paso "3. Respaldo con Velero, con los discos incluidos"
T_RESPALDO=$(marca)
velero backup create "$RESPALDO" --include-namespaces "$NS" --snapshot-volumes --ttl 72h --wait
velero backup describe "$RESPALDO" 2>/dev/null | grep -E "^Phase|Started|Completed|Items backed up" | sed 's/^/  /'

paso "4. Escribo un producto DESPUES del respaldo (este se pierde: es el RPO)"
T_PERDIDO=$(marca)
sql "$NS" "insert into productos (nombre, descripcion, precio, stock_disponible, categoria_id) values ('DESPUES DEL RESPALDO $SELLO', 'Se escribio despues del respaldo', 222.22, 3, '$CAT');" >/dev/null
echo "  productos antes del desastre: $(sql "$NS" 'select count(*) from productos;')"

paso "5. Espero a que los snapshots queden READY en GCP"
esperar_snapshots

paso "6. Desastre: borro TODOS los productos"
T_DESASTRE=$(marca)
sql "$NS" 'delete from productos;' >/dev/null
echo "  quedan: $(sql "$NS" 'select count(*) from productos;') productos"

paso "7. Restauro el postgres del respaldo en $NS_TEMP"
T_INICIO_REC=$(marca)
velero restore create "restaurar-$SELLO" \
  --from-backup "$RESPALDO" \
  --namespace-mappings "$NS:$NS_TEMP" \
  --include-resources statefulsets,persistentvolumeclaims,persistentvolumes,configmaps,services,serviceaccounts \
  --selector "app.kubernetes.io/name=postgres" \
  --wait
velero restore describe "restaurar-$SELLO" 2>/dev/null | grep -E "^Phase|Started|Completed|Warnings" | sed 's/^/  /'

# El Secret de postgres lo crea Sealed Secrets dentro del cluster y no lleva la
# etiqueta del chart, asi que el filtro de arriba lo deja fuera. Lo copio desde
# produccion: lo que se esta probando son los datos del disco, no el secreto.
paso "8. Copio el Secret de postgres al namespace temporal"
kubectl -n "$NS" get secret postgres-secreto -o json |
  python -c "
import json, sys
s = json.load(sys.stdin)
s['metadata'] = {'name': 'postgres-secreto', 'namespace': '$NS_TEMP'}
s.pop('status', None)
print(json.dumps(s))
" | kubectl apply -f - >/dev/null
kubectl -n "$NS_TEMP" delete pod postgres-0 --ignore-not-found >/dev/null 2>&1

paso "9. Espero a que el postgres restaurado levante"
kubectl -n "$NS_TEMP" wait --for=condition=ready pod/postgres-0 --timeout=300s

paso "10. Verifico el CONTENIDO restaurado, no solo que el disco exista"
echo "  productos en el respaldo: $(sql "$NS_TEMP" 'select count(*) from productos;')"
sql "$NS_TEMP" "select '  - ' || nombre || ' | Q' || precio from productos order by nombre;"

paso "11. Devuelvo los datos a produccion"
kubectl -n "$NS_TEMP" exec postgres-0 -- sh -c \
  'PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U "$POSTGRES_USER" -d db_productos --data-only --table=productos' 2>/dev/null |
  kubectl -n "$NS" exec -i postgres-0 -- sh -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d db_productos -q' >/dev/null
T_FIN_REC=$(marca)

paso "12. Estado final de produccion"
echo "  productos: $(sql "$NS" 'select count(*) from productos;')"
sql "$NS" "select '  - ' || nombre || ' | Q' || precio from productos order by nombre;"

paso "13. Limpio el namespace temporal y su disco"
kubectl delete ns "$NS_TEMP" --wait=false >/dev/null

echo
echo "===== Resumen"
echo "  Respaldo tomado:            $T_RESPALDO"
echo "  Dato escrito despues:       $T_PERDIDO"
echo "  Desastre (borrado):         $T_DESASTRE"
echo "  Inicio de la recuperacion:  $T_INICIO_REC"
echo "  Fin de la recuperacion:     $T_FIN_REC"
echo
echo "  RPO medido: se pierde lo escrito entre el respaldo y el desastre."
echo "              En esta prueba, el producto 'DESPUES DEL RESPALDO $SELLO'."
echo "  RTO de datos: del inicio al fin de la recuperacion."
