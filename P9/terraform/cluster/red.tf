# Base de red del namespace, la misma de la P5: primero se cierra todo y despues
# cada chart abre solo lo suyo (quien puede entrarle). Va en Terraform porque es
# parte del namespace, como la cuota: no depende de que app este instalada.

# Pod selector vacio significa todos los Pods: cierra entrada y salida de un golpe.
resource "kubernetes_network_policy_v1" "denegar_todo" {
  metadata {
    name      = "denegar-todo"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = local.etiquetas
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }
}

# Reabre solo el DNS: sin esto ningun Pod podria resolver nombres como postgres.
resource "kubernetes_network_policy_v1" "permitir_dns" {
  metadata {
    name      = "permitir-dns"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = local.etiquetas
  }

  spec {
    pod_selector {}
    policy_types = ["Egress"]

    egress {
      to {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "kube-system" }
        }
      }
      ports {
        protocol = "UDP"
        port     = "53"
      }
      ports {
        protocol = "TCP"
        port     = "53"
      }
    }
  }
}

# Salida libre dentro del namespace: una conexion necesita permiso en los dos
# extremos, y el control real lo hacen las reglas de entrada de cada chart.
resource "kubernetes_network_policy_v1" "salida_interna" {
  metadata {
    name      = "salida-interna"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = local.etiquetas
  }

  spec {
    pod_selector {}
    policy_types = ["Egress"]

    egress {
      to {
        pod_selector {}
      }
    }
  }
}
