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
