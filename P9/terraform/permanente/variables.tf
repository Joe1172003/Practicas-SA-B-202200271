variable "proyecto" {
  description = "Proyecto de GCP donde vive todo."
  type        = string
  default     = "sa-p6-202200271"
}

variable "region" {
  description = "Region de los recursos regionales (IP, buckets)."
  type        = string
  default     = "us-central1"
}

variable "bucket_velero" {
  description = "Bucket de los respaldos de Velero."
  type        = string
  default     = "sa-p9-velero-202200271"
}
