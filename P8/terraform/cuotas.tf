# Techo total del namespace: los mismos valores de la P5, salvo pods. Durante un
# canary conviven la version estable, la nueva y los pods de analisis.
resource "kubernetes_resource_quota_v1" "plataforma" {
  metadata {
    name      = "cuota"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = local.etiquetas
  }

  spec {
    hard = {
      # requests es lo que el planificador reserva; limits, el techo que nadie pasa.
      "requests.cpu"         = "2"
      "requests.memory"      = "3Gi"
      "limits.cpu"           = "6"
      "limits.memory"        = "6Gi"
      pods                   = "30"
      persistentvolumeclaims = "5"
    }
  }
}

# Con cuota activa, un contenedor sin requests ni limits es rechazado: esto le
# pone valores por defecto y un maximo por contenedor.
resource "kubernetes_limit_range_v1" "plataforma" {
  metadata {
    name      = "limites"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = local.etiquetas
  }

  spec {
    limit {
      type            = "Container"
      default         = { cpu = "200m", memory = "256Mi" }
      default_request = { cpu = "25m", memory = "64Mi" }
      max             = { cpu = "1", memory = "1Gi" }
      min             = { cpu = "10m", memory = "16Mi" }
    }
  }
}
