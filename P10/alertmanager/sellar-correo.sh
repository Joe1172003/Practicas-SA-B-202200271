#!/usr/bin/env bash
# Sella la configuracion de Alertmanager con el correo de alertas.
# Pide los datos por teclado (la clave sin mostrarla) y no deja nada en disco
# salvo el SealedSecret cifrado.
#   bash sellar-correo.sh [ruta-de-salida]
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
PLANTILLA="$AQUI/alertmanager.plantilla.yaml"
SALIDA="${1:-$AQUI/../../../sa-p8-gitops/secretos/alertmanager-correo.yaml}"

read -rp  "Correo que ENVIA (la cuenta nueva): " ENVIA
read -rp  "Correo que RECIBE las alertas: " RECIBE
read -rsp "Contrasena de aplicacion (no se muestra): " CLAVE; echo
# Google la muestra en grupos de 4 con espacios.
CLAVE="${CLAVE// /}"

[[ "$ENVIA" == *@*.* && "$RECIBE" == *@*.* ]] || { echo "Algun correo no tiene formato valido"; exit 1; }
[[ ${#CLAVE} -eq 16 ]] || { echo "La clave deberia tener 16 letras (tiene ${#CLAVE})"; exit 1; }

# Todo por tuberia: la configuracion con la clave nunca se escribe en un archivo.
# Python arma el Secret en memoria (los datos le llegan por variables de
# entorno, no como argumentos visibles) y kubeseal lo cifra.
PLANTILLA_W="$(cygpath -w "$PLANTILLA" 2>/dev/null || echo "$PLANTILLA")"
ENVIA="$ENVIA" RECIBE="$RECIBE" CLAVE="$CLAVE" PLANTILLA_W="$PLANTILLA_W" python -c '
import base64, json, os
t = open(os.environ["PLANTILLA_W"], encoding="utf-8").read()
for marca in ("ENVIA", "RECIBE", "CLAVE"):
    t = t.replace("__%s__" % marca, os.environ[marca])
print(json.dumps({"apiVersion": "v1", "kind": "Secret",
    "metadata": {"name": "alertmanager-correo", "namespace": "observabilidad"},
    "data": {"alertmanager.yaml": base64.b64encode(t.encode()).decode()}}))
' | kubeseal --controller-name sealed-secrets-controller --controller-namespace sealed-secrets \
      --format yaml > "$SALIDA"

echo "Listo: $SALIDA"
grep -q "alertmanager.yaml:" "$SALIDA" && echo "El secreto sellado tiene la configuracion."
