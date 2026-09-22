#!/usr/bin/env bash
# Crea el bucket donde Terraform guarda su estado, si todavia no existe.
#
# Es el unico recurso que Terraform no puede crearse a si mismo: necesita el
# bucket para guardar el estado del propio bucket. Por eso lo crea este script,
# y se puede correr las veces que sea: si el bucket ya esta, no toca nada.
set -euo pipefail

PROYECTO="${PROYECTO:-sa-p6-202200271}"
REGION="${REGION:-us-central1}"
BUCKET="${BUCKET_ESTADO:-sa-p9-tfstate-202200271}"

if gcloud storage buckets describe "gs://$BUCKET" --project "$PROYECTO" >/dev/null 2>&1; then
  echo "El bucket gs://$BUCKET ya existe. No hago nada."
  exit 0
fi

echo "Creando gs://$BUCKET en $REGION..."
# Acceso uniforme y sin acceso publico: el estado puede guardar datos sensibles.
gcloud storage buckets create "gs://$BUCKET" \
  --project "$PROYECTO" \
  --location "$REGION" \
  --uniform-bucket-level-access \
  --public-access-prevention

# Con versionado, si un apply deja el estado mal puedo volver a la version
# anterior del archivo.
gcloud storage buckets update "gs://$BUCKET" --versioning

echo "Listo: gs://$BUCKET con versionado y sin acceso publico."
