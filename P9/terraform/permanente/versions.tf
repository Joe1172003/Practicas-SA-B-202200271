# Capa permanente: lo que tiene que sobrevivir cuando el cluster se pierde.
# Bucket de respaldos, IP del ingress, cuenta de servicio de Velero y la copia
# de la llave de Sealed Secrets. El simulacro de desastre nunca destruye esta
# capa.
terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.3"
    }
  }

  # El estado vive fuera de mi maquina. GCS bloquea el estado con un archivo
  # .tflock mientras alguien hace plan o apply, asi que dos personas no pueden
  # pisarse. El bucket lo crea bootstrap/preparar-estado.sh.
  backend "gcs" {
    bucket = "sa-p9-tfstate-202200271"
    prefix = "permanente"
  }
}
