#!/usr/bin/env bash
# Guarda en Secret Manager las llaves de Sealed Secrets que tiene el cluster.
#
# Hay que correrlo cada vez que Sealed Secrets genere una llave nueva (lo hace
# cada 30 dias) y despues de sellar secretos nuevos. Si no, una reconstruccion
# repondria llaves viejas y los secretos sellados con la llave nueva quedarian
# ilegibles.
#
# El contenido no se imprime en ningun momento: va del cluster a Secret Manager
# por una tuberia, y el archivo temporal se borra al salir.
set -euo pipefail

PROYECTO="${PROYECTO:-sa-p6-202200271}"
SECRETO="${SECRETO:-sa-p9-sealed-secrets-llave}"
NAMESPACE="${NAMESPACE:-sealed-secrets}"

TEMPORAL="$(mktemp)"
trap 'rm -f "$TEMPORAL"' EXIT

kubectl -n "$NAMESPACE" get secrets \
  -l sealedsecrets.bitnami.com/sealed-secrets-key -o json |
  python -c '
import json, sys
crudo = json.load(sys.stdin)
llaves = [{
    "nombre": item["metadata"]["name"],
    "tls.crt": item["data"]["tls.crt"],
    "tls.key": item["data"]["tls.key"],
} for item in crudo["items"]]
if not llaves:
    sys.exit("No encontre ninguna llave de Sealed Secrets en el cluster.")
json.dump(llaves, open(sys.argv[1], "w"))
print(f"Llaves encontradas: {len(llaves)}")
for l in llaves:
    print(f"  {l[\"nombre\"]}")
' "$TEMPORAL"

gcloud secrets versions add "$SECRETO" --data-file="$TEMPORAL" --project "$PROYECTO"

echo "Listo. Versiones guardadas:"
gcloud secrets versions list "$SECRETO" --project "$PROYECTO" --format="table(name,state,createTime)"
