provider "kubernetes" {
  config_path    = var.kubeconfig
  config_context = var.contexto
}

# El mismo cluster y el mismo contexto: Helm entra por la misma puerta.
provider "helm" {
  kubernetes = {
    config_path    = var.kubeconfig
    config_context = var.contexto
  }
}
