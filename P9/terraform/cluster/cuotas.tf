# Misma cuota que la P8, con el mismo calculo del pico de un despliegue:
# gateway con estable y canary completos, auth/productos/ordenes en el maximo
# del HPA mas el Pod extra del rolling update, notificaciones, postgres,
# rabbitmq, los dos cronjobs y el Job de k6 del analisis.
resource "kubernetes_resource_quota_v1" "plataforma" {
  metadata {
    name      = "cuota"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = local.etiquetas
  }

  spec {
    hard = {
      "requests.cpu"    = "2"
      "requests.memory" = "4Gi"
      "limits.cpu"      = "9"
      "limits.memory"   = "9Gi"
      pods              = "30"
      # Uno mas que en la P8: durante una restauracion de Velero conviven el
      # disco viejo y el restaurado.
      persistentvolumeclaims = "6"
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
