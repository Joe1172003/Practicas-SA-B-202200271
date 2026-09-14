# El archivo .terraform.lock.hcl congela la version exacta.
terraform {
  required_version = ">= 1.6"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.2"
    }
    # Para instalar ArgoCD con su chart oficial en vez de copiar sus manifiestos.
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.3"
    }
  }
}
