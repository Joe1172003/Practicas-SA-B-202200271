# Lo que ArgoCD y los charts necesitan saber de lo que construyo Terraform.
output "namespace_plataforma" {
  value = kubernetes_namespace_v1.plataforma.metadata[0].name
}

output "consola_argocd" {
  description = "La consola no esta expuesta a internet: se abre con este tunel y queda en http://localhost:8080"
  value       = "kubectl -n ${helm_release.argocd.namespace} port-forward svc/argocd-server 8080:80"
}

output "controlador_sealed_secrets" {
  description = "Donde vive el controlador: kubeseal lo necesita para bajar la llave publica"
  value       = "${helm_release.sealed_secrets.namespace}/sealed-secrets-controller"
}

output "service_accounts" {
  value = concat(
    sort(keys(kubernetes_service_account_v1.componente)),
    [kubernetes_service_account_v1.rabbitmq.metadata[0].name],
  )
}
