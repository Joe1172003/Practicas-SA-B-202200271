#!/usr/bin/env bash
# Levanta la plataforma completa desde cero. Un solo comando, sin pasos a mano.
#
#   bash reconstruir.sh              reconstruye y restaura los datos del ultimo respaldo
#   bash reconstruir.sh --sin-datos  reconstruye y deja la base vacia
#
# Necesita: gcloud con sesion iniciada, terraform, kubectl, helm y velero.
set -uo pipefail

PROYECTO="${PROYECTO:-sa-p6-202200271}"
ZONA="${ZONA:-us-central1-a}"
CLUSTER="${CLUSTER:-sa-p9}"
NS="${NS:-sa-p8}"
NS_TEMP="sa-p8-restaurado"
APPS_ESPERADAS="${APPS_ESPERADAS:-15}"
RESTAURAR_DATOS=true
[ "${1:-}" = "--sin-datos" ] && RESTAURAR_DATOS=false

AQUI="$(cd "$(dirname "$0")" && pwd)"
TERRAFORM="$AQUI/../terraform"
SELLO="$(date -u +%Y%m%d-%H%M%S)"
BITACORA="$AQUI/../evidencias/reconstruccion-$SELLO.txt"

marca() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
paso() { echo; echo "===== $(marca)  $*" | tee -a "$BITACORA"; }
nota() { echo "  $*" | tee -a "$BITACORA"; }
morir() { echo "  FALLO: $*" | tee -a "$BITACORA"; exit 1; }

T_INICIO=$(marca)
echo "Reconstruccion de la plataforma - $T_INICIO" > "$BITACORA"
nota "proyecto $PROYECTO, cluster $CLUSTER, zona $ZONA"

paso "1. Herramientas"
for h in gcloud terraform kubectl helm velero; do
  command -v "$h" >/dev/null 2>&1 || morir "falta $h"
done
gcloud auth print-access-token >/dev/null 2>&1 || morir "gcloud sin sesion: corre gcloud auth login"
nota "todo presente"

paso "2. Bucket del estado de Terraform"
# Es lo unico que Terraform no puede crearse a si mismo.
bash "$AQUI/preparar-estado.sh" 2>&1 | tee -a "$BITACORA"

paso "3. Capa permanente (respaldos, IP fija, cuenta de Velero, llave)"
# Normalmente no cambia nada: esta capa sobrevive al desastre.
cd "$TERRAFORM/permanente" || morir "no encuentro terraform/permanente"
terraform init -input=false -no-color >/dev/null || morir "terraform init de la capa permanente"
terraform apply -input=false -auto-approve -no-color 2>&1 | tail -3 | tee -a "$BITACORA"

paso "4. Cluster, nodos y ArgoCD"
cd "$TERRAFORM/cluster" || morir "no encuentro terraform/cluster"
terraform init -input=false -no-color >/dev/null || morir "terraform init de la capa del cluster"
# Primero el cluster: hasta que no existe, Terraform no sabe a donde conectarse
# para crear los objetos de Kubernetes.
terraform apply -input=false -auto-approve -no-color \
  -target=google_container_node_pool.principal 2>&1 | tail -3 | tee -a "$BITACORA"
terraform apply -input=false -auto-approve -no-color 2>&1 | tail -3 | tee -a "$BITACORA"
T_TERRAFORM=$(marca)

paso "5. Credenciales de kubectl"
gcloud container clusters get-credentials "$CLUSTER" --zone "$ZONA" --project "$PROYECTO" 2>&1 | tee -a "$BITACORA"
kubectl get nodes -o custom-columns=NODO:.metadata.name,ESTADO:.status.conditions[-1].type --no-headers | tee -a "$BITACORA"

paso "6. ArgoCD despliega la plataforma"
# De aca en adelante no toco nada: la app raiz levanta herramientas y servicios.
nota "esperando a que las $APPS_ESPERADAS apps queden Synced y Healthy (hasta 20 minutos)"
LIMITE=$((SECONDS + 1200))
while [ $SECONDS -lt $LIMITE ]; do
  SANAS=$(kubectl -n argocd get app --no-headers 2>/dev/null | awk '$2=="Synced" && $3=="Healthy"' | wc -l)
  [ "$SANAS" -ge "$APPS_ESPERADAS" ] && break
  sleep 20
done
kubectl -n argocd get app --no-headers | awk '{printf "  %-16s %s %s\n", $1, $2, $3}' | tee -a "$BITACORA"
[ "$SANAS" -ge "$APPS_ESPERADAS" ] || nota "AVISO: solo $SANAS apps sanas, sigo igual"
T_ARGOCD=$(marca)

if [ "$RESTAURAR_DATOS" = true ]; then
  paso "7. Datos desde el ultimo respaldo de Velero"
  # Velero recien instalado tarda un poco en leer los respaldos del bucket.
  LIMITE=$((SECONDS + 300))
  while [ $SECONDS -lt $LIMITE ]; do
    velero backup get 2>/dev/null | grep -q Completed && break
    sleep 15
  done

  RESPALDO=$(velero backup get -o json 2>/dev/null |
    python -c "import json,sys; b=json.load(sys.stdin); items=b.get('items',[b]); ok=[i for i in items if i['status'].get('phase')=='Completed']; print(sorted(ok, key=lambda i: i['status']['startTimestamp'])[-1]['metadata']['name'] if ok else '')")
  [ -n "$RESPALDO" ] || morir "no hay ningun respaldo completado para restaurar"
  nota "uso el respaldo $RESPALDO"

  # Restauro en un namespace aparte para no pelear con ArgoCD, que manda en sa-p8.
  # Dos intentos: el primero suele fallar si el snapshot todavia no esta READY.
  for INTENTO in 1 2; do
    RESTAURACION="bootstrap-$SELLO-$INTENTO"
    velero restore create "$RESTAURACION" --from-backup "$RESPALDO"       --namespace-mappings "$NS:$NS_TEMP"       --include-resources statefulsets,persistentvolumeclaims,persistentvolumes,configmaps,services,serviceaccounts       --selector "app.kubernetes.io/name=postgres" --wait 2>&1 | tail -2 | tee -a "$BITACORA"

    ESTADO=$(velero restore get "$RESTAURACION" -o json 2>/dev/null |
      python -c "import json,sys; print(json.load(sys.stdin)['status'].get('phase',''))")
    nota "restauracion $RESTAURACION: $ESTADO"
    [ "$ESTADO" = "Completed" ] && break

    velero restore describe "$RESTAURACION" 2>/dev/null | grep -A3 "^Errors" | tee -a "$BITACORA"
    [ "$INTENTO" = "2" ] && morir "la restauracion no termino bien, revisa el error de arriba"
    nota "reintento en 60 segundos"
    kubectl delete ns "$NS_TEMP" --wait=true --timeout=180s >/dev/null 2>&1
    sleep 60
  done

  # El Secret lo crea Sealed Secrets y no lleva la etiqueta del chart, por eso lo copio.
  kubectl -n "$NS" get secret postgres-secreto -o json |
    python -c "
import json, sys
s = json.load(sys.stdin)
s['metadata'] = {'name': 'postgres-secreto', 'namespace': '$NS_TEMP'}
s.pop('status', None)
print(json.dumps(s))
" | kubectl apply -f - >/dev/null
  kubectl -n "$NS_TEMP" delete pod postgres-0 --ignore-not-found >/dev/null 2>&1
  kubectl -n "$NS_TEMP" wait --for=condition=ready pod/postgres-0 --timeout=300s | tee -a "$BITACORA" ||
    morir "el postgres restaurado no arranco"

  # Paso todas las bases del respaldo a la base nueva.
  kubectl -n "$NS_TEMP" exec postgres-0 -- sh -c     'PGPASSWORD=$POSTGRES_PASSWORD pg_dumpall -U "$POSTGRES_USER" --clean --if-exists' 2>/dev/null |
    kubectl -n "$NS" exec -i postgres-0 -- sh -c     'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d postgres -q' >/dev/null 2>&1

  # Reviso que los datos esten de verdad, no solo que el disco se haya montado.
  FILAS=$(kubectl -n "$NS" exec -i postgres-0 -- sh -c     'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d db_productos -At' <<< "select count(*) from productos;" 2>/dev/null | tr -d '
')
  [ "${FILAS:-0}" -gt 0 ] || morir "la base quedo vacia despues de restaurar"

  kubectl delete ns "$NS_TEMP" --wait=false >/dev/null 2>&1
  nota "datos restaurados"
fi
T_DATOS=$(marca)

paso "8. Pruebas de que el sistema responde"
IP=$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
HOST="$IP.nip.io"
nota "gateway en http://$HOST"

SALUD=$(curl -s -m 15 -o /dev/null -w "%{http_code}" -H "Host: $HOST" "http://$IP/health")
nota "/health respondio $SALUD"
CATALOGO=$(curl -s -m 20 -X POST -H "Host: $HOST" -H "Content-Type: application/json" \
  -d '{"query":"{ productos { nombre precio } }"}' "http://$IP/graphql/productos")
nota "catalogo: $(echo "$CATALOGO" | head -c 200)"

PRODUCTOS=$(kubectl -n "$NS" exec -i postgres-0 -- sh -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d db_productos -At' <<< "select count(*) from productos;" 2>/dev/null | tr -d '\r')
USUARIOS=$(kubectl -n "$NS" exec -i postgres-0 -- sh -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d db_auth -At' <<< "select count(*) from users;" 2>/dev/null | tr -d '\r')
nota "en la base: $PRODUCTOS productos y $USUARIOS usuarios"
T_FIN=$(marca)

paso "9. Tiempos"
nota "inicio                $T_INICIO"
nota "terraform listo       $T_TERRAFORM"
nota "apps sanas            $T_ARGOCD"
nota "datos restaurados     $T_DATOS"
nota "fin                   $T_FIN"
echo
nota "bitacora: $(basename "$BITACORA")"
