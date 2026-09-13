# Versiones fijadas: el mismo plano tiene que construir lo mismo hoy y el dia
# de la calificacion. El archivo .terraform.lock.hcl congela la version exacta.
terraform {
  required_version = ">= 1.6"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.2"
    }
  }
}
