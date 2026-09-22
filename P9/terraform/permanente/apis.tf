# APIs de GCP que usa todo el sistema. Encenderlas desde aca evita que una
# reconstruccion en un proyecto nuevo falle por una API apagada.
#
# disable_on_destroy = false: si alguna vez destruyo esta capa, no quiero
# apagar APIs que otras cosas del proyecto (el cluster de la P6) siguen usando.
locals {
  apis = [
    "compute.googleapis.com",
    "container.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
  ]
}

resource "google_project_service" "api" {
  for_each = toset(local.apis)

  service            = each.value
  disable_on_destroy = false
}
