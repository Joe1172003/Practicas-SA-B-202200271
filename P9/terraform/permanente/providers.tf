# Las credenciales salen de gcloud (application-default login) o de Cloud Shell.
# En el repositorio no hay ninguna llave.
provider "google" {
  project = var.proyecto
  region  = var.region
}
