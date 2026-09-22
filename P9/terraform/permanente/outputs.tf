# Datos que usan la capa del cluster, el repositorio GitOps y el README.
# Ninguno es secreto.
output "bucket_velero" {
  description = "Bucket donde Velero guarda los respaldos."
  value       = google_storage_bucket.velero.name
}

output "cuenta_velero" {
  description = "Cuenta de servicio de GCP que usa Velero."
  value       = google_service_account.velero.email
}

output "ip_ingress" {
  description = "IP fija del ingress-nginx."
  value       = google_compute_address.ingress.address
}

output "host_gateway" {
  description = "Host del gateway, resuelto por nip.io sin comprar dominio."
  value       = "${google_compute_address.ingress.address}.nip.io"
}

output "secreto_llave" {
  description = "Secreto de Secret Manager con la copia de la llave de Sealed Secrets."
  value       = google_secret_manager_secret.llave_sealed_secrets.secret_id
}
