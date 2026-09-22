# Capa del cluster: lo que se destruye en el simulacro y se reconstruye con el
# bootstrap. El cluster GKE, ArgoCD y la app raiz. Todo lo demas lo levanta
# ArgoCD desde el repositorio GitOps.
terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.3"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.2"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.3"
    }
  }

  # Mismo bucket que la capa permanente, otra carpeta. Cada capa tiene su
  # propio estado y su propio bloqueo.
  backend "gcs" {
    bucket = "sa-p9-tfstate-202200271"
    prefix = "cluster"
  }
}
