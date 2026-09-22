variable "proyecto" {
  description = "Proyecto de GCP donde vive todo."
  type        = string
  default     = "sa-p6-202200271"
}

variable "region" {
  description = "Region del proyecto."
  type        = string
  default     = "us-central1"
}

# Zonal y no regional: el plano de control de un cluster zonal entra en la
# capa gratuita de GKE.
variable "zona" {
  description = "Zona del cluster."
  type        = string
  default     = "us-central1-a"
}

variable "nombre_cluster" {
  description = "Nombre del cluster GKE."
  type        = string
  default     = "sa-p9"
}
