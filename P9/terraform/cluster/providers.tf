provider "google" {
  project = var.proyecto
  region  = var.region
}

# El token de la sesion de gcloud (o de Cloud Shell). Dura una hora y se pide
# en cada corrida: no queda ninguna credencial en disco.
data "google_client_config" "actual" {}

# Lo que la P8 hacia con ~/.kube/config y un contexto fijo, aca sale del propio
# cluster que Terraform acaba de crear. Asi no depende de la maquina de nadie y
# no hay forma de aplicar por error sobre minikube.
provider "kubernetes" {
  host                   = "https://${google_container_cluster.sa_p9.endpoint}"
  cluster_ca_certificate = base64decode(google_container_cluster.sa_p9.master_auth[0].cluster_ca_certificate)
  token                  = data.google_client_config.actual.access_token
}

provider "helm" {
  kubernetes = {
    host                   = "https://${google_container_cluster.sa_p9.endpoint}"
    cluster_ca_certificate = base64decode(google_container_cluster.sa_p9.master_auth[0].cluster_ca_certificate)
    token                  = data.google_client_config.actual.access_token
  }
}

# Datos de la capa permanente: el bucket de Velero, la IP del ingress y la
# cuenta de servicio. Se leen del estado remoto, no se copian a mano.
data "terraform_remote_state" "permanente" {
  backend = "gcs"

  config = {
    bucket = "sa-p9-tfstate-202200271"
    prefix = "permanente"
  }
}
