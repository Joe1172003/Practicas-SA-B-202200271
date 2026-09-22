# Continuidad de los secretos.
#
# El problema: los 8 SealedSecrets del repositorio GitOps estan cifrados con
# una llave que Sealed Secrets genera dentro del cluster. Si el cluster se
# pierde, el controlador nuevo genera OTRA llave y ninguno de esos secretos se
# puede abrir: el repositorio queda lleno de contenido ilegible.
#
# La solucion: la llave vive respaldada en Secret Manager y Terraform la repone
# aca, en el namespace sealed-secrets, ANTES de que ArgoCD instale el
# controlador. Al arrancar, el controlador encuentra la llave vieja y la
# adopta, asi que los SealedSecrets de siempre se descifran sin volver a
# sellarlos.
#
# El valor nunca pasa por el codigo ni por Git: se carga a Secret Manager con
# gcloud (ver P9/bootstrap/respaldar-llave.sh) y de ahi lo lee Terraform.

data "google_secret_manager_secret_version" "llave_sealed_secrets" {
  secret = data.terraform_remote_state.permanente.outputs.secreto_llave
  # Sin version fija: siempre la ultima, por si la llave se rota.
  version = "latest"
}

locals {
  # El secreto guarda una lista, no una sola llave: Sealed Secrets renueva su
  # llave cada 30 dias y conserva las viejas para poder descifrar lo que se
  # sello con ellas. Hay que reponerlas todas.
  llaves_sealed_secrets = {
    for llave in jsondecode(data.google_secret_manager_secret_version.llave_sealed_secrets.secret_data) :
    llave.nombre => llave
  }

  # Todo lo que sale de Secret Manager queda marcado como sensible, y Terraform
  # no acepta valores sensibles como clave de un for_each. Los nombres de las
  # llaves no son secretos (el contenido si), asi que los desmarco solo a ellos.
  nombres_llaves = nonsensitive(toset(keys(local.llaves_sealed_secrets)))
}

resource "kubernetes_secret_v1" "llave_sealed_secrets" {
  for_each = local.nombres_llaves

  metadata {
    name      = each.key
    namespace = kubernetes_namespace_v1.sealed_secrets.metadata[0].name
    # Esta etiqueta es la que hace que el controlador la reconozca como suya.
    # Sin ella, la ignora y genera una llave nueva.
    labels = {
      "sealedsecrets.bitnami.com/sealed-secrets-key" = "active"
    }
  }

  type = "kubernetes.io/tls"

  # El JSON las guarda en base64 (como las devuelve Kubernetes) y el provider
  # vuelve a codificarlas, por eso hay que decodificarlas aca.
  data = {
    "tls.crt" = base64decode(local.llaves_sealed_secrets[each.key]["tls.crt"])
    "tls.key" = base64decode(local.llaves_sealed_secrets[each.key]["tls.key"])
  }
}
