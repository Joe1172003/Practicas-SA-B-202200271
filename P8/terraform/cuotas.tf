# Techo total del namespace. Va dimensionado para el pico de un despliegue, no
# para el reposo: en el canary de la 2.2.0 la cuota de 6 CPU / 6Gi se lleno y
# Kubernetes rechazo Pods, incluido el Job de k6 del analisis.
#
# Pico calculado con los valores de prod: gateway con estable y canary completos
# (6 Pods), auth/productos/ordenes en el maximo del HPA mas el Pod extra del
# rolling update (4 cada uno), notificaciones 2, postgres, rabbitmq, los dos
# cronjobs a la vez y el Job de k6. Da 7.7 CPU y 7.4Gi de limits, y 2.9Gi de
# requests de memoria: la cuota queda un 15% arriba de eso.
resource "kubernetes_resource_quota_v1" "plataforma" {
  metadata {
    name      = "cuota"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = local.etiquetas
  }

  spec {
    hard = {
      # requests es lo que el planificador reserva; limits, el techo que nadie pasa.
      # La suma de limits puede pasar el CPU de los nodos: son techos por Pod,
      # no reservas. Lo que de verdad reserva es requests.cpu.
      "requests.cpu"         = "2"
      "requests.memory"      = "4Gi"
      "limits.cpu"           = "9"
      "limits.memory"        = "9Gi"
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
