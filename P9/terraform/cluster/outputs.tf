output "cluster" {
  description = "Nombre del cluster."
  value       = google_container_cluster.sa_p9.name
}

output "credenciales" {
  description = "Comando para que kubectl apunte a este cluster."
  value       = "gcloud container clusters get-credentials ${google_container_cluster.sa_p9.name} --zone ${var.zona} --project ${var.proyecto}"
}

output "version_gke" {
  description = "Version del plano de control."
  value       = google_container_cluster.sa_p9.master_version
}

output "host_gateway" {
  description = "Host publico del gateway, con la IP fija de la capa permanente."
  value       = data.terraform_remote_state.permanente.outputs.host_gateway
}

output "consola_argocd" {
  description = "Como abrir la consola de ArgoCD."
  value       = "kubectl -n argocd port-forward svc/argocd-server 8080:80"
}
