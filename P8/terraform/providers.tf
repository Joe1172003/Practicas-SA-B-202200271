# Terraform se corre desde mi maquina, nunca desde el pipeline: el pipeline no
# tiene credenciales del cluster, y esa es justamente la idea de la P8.
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
