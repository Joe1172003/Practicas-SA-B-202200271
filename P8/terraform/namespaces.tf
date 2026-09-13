# Un namespace para la plataforma y uno por herramienta. Separados, una cuota o
# una politica de uno no alcanza a los demas.
locals {
  namespaces_herramientas = ["argocd", "argo-rollouts", "kyverno", "sealed-secrets"]

  etiquetas = {
    "app.kubernetes.io/part-of"    = "sa-p8"
    "app.kubernetes.io/managed-by" = "terraform"
  }
}

# Los namespaces son de Terraform y no de los charts: asi ArgoCD puede sacar y
# meter aplicaciones sin llevarse el namespace, y con el los discos.
resource "kubernetes_namespace_v1" "plataforma" {
  metadata {
    name   = var.namespace_plataforma
    labels = merge(local.etiquetas, { entorno = "prod" })
  }
}

resource "kubernetes_namespace_v1" "herramientas" {
  for_each = toset(local.namespaces_herramientas)

  metadata {
    name   = each.value
    labels = local.etiquetas
  }
}

# Este lo creo Helm a mano en la P6. El import lo anota en el state sin
# recrearlo; se describe tal como esta para que el import no lo modifique.
import {
  to = kubernetes_namespace_v1.ingress_nginx
  id = "ingress-nginx"
}

resource "kubernetes_namespace_v1" "ingress_nginx" {
  metadata {
    name   = "ingress-nginx"
    labels = { name = "ingress-nginx" }
  }
}
