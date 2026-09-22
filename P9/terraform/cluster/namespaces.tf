# Los namespaces son de Terraform y no de los charts: asi ArgoCD puede sacar y
# meter aplicaciones sin llevarse el namespace, y con el los discos.
#
# A diferencia de la P8, aca Terraform solo crea dos: el de la plataforma y el
# de ArgoCD. Los de las demas herramientas (kyverno, argo-rollouts,
# ingress-nginx, velero) los crea ArgoCD al desplegarlas, porque a partir de la
# P9 esas herramientas se instalan por GitOps.
#
# sealed-secrets es la excepcion: su namespace tiene que existir antes que la
# herramienta, porque ahi adentro Terraform repone la llave de respaldo.
locals {
  etiquetas = {
    "app.kubernetes.io/part-of"    = "sa-p9"
    "app.kubernetes.io/managed-by" = "terraform"
  }
}

resource "kubernetes_namespace_v1" "plataforma" {
  metadata {
    name   = var.namespace_plataforma
    labels = merge(local.etiquetas, { entorno = "prod" })
  }

  depends_on = [google_container_node_pool.principal]
}

resource "kubernetes_namespace_v1" "argocd" {
  metadata {
    name   = "argocd"
    labels = local.etiquetas
  }

  depends_on = [google_container_node_pool.principal]
}

resource "kubernetes_namespace_v1" "sealed_secrets" {
  metadata {
    name   = "sealed-secrets"
    labels = local.etiquetas
  }

  depends_on = [google_container_node_pool.principal]
}
