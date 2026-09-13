# Lo que ArgoCD y los charts necesitan saber de lo que construyo Terraform.
output "namespace_plataforma" {
  value = kubernetes_namespace_v1.plataforma.metadata[0].name
}

output "service_accounts" {
  value = concat(
    sort(keys(kubernetes_service_account_v1.componente)),
    [kubernetes_service_account_v1.rabbitmq.metadata[0].name],
  )
}
