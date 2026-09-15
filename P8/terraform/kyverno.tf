# Kyverno: el guardia de la puerta. Revisa cada Pod de sa-p8 antes de que se
# cree y rechaza lo que no cumple las politicas (P8/charts/politicas). Las
# politicas no van aca: las aplica ArgoCD desde Git, como el resto.
resource "helm_release" "kyverno" {
  name       = "kyverno"
  repository = "https://kyverno.github.io/kyverno/"
  chart      = "kyverno"
  version    = "3.9.1" # Kyverno v1.19.1
  namespace  = kubernetes_namespace_v1.herramientas["kyverno"].metadata[0].name

  create_namespace = false
  wait             = true
  timeout          = 600

  values = [yamlencode({
    # El que decide en cada peticion. Con 50m y no los 100m del chart: los
    # nodos tienen poco CPU libre y aca solo revisa los Pods de un namespace.
    admissionController = {
      replicas = 1
      container = {
        resources = {
          requests = { cpu = "50m", memory = "128Mi" }
          limits   = { memory = "512Mi" }
        }
      }
    }

    # Arma los reportes de lo que cumple y lo que no (sirven en modo Audit).
    reportsController = {
      resources = {
        requests = { cpu = "25m", memory = "64Mi" }
        limits   = { memory = "256Mi" }
      }
    }

    # Estos dos crean o borran recursos por su cuenta. Mis politicas solo
    # validan, asi que no los necesito: son 200m menos de CPU reservado.
    backgroundController = { enabled = false }
    cleanupController    = { enabled = false }

    config = {
      webhooks = {
        # Kubernetes solo le consulta a Kyverno por lo que pasa en sa-p8. Si
        # Kyverno se cae, el resto del cluster (kube-system, argocd) sigue igual.
        namespaceSelector = {
          matchExpressions = [{
            key      = "kubernetes.io/metadata.name"
            operator = "In"
            values   = [var.namespace_plataforma]
          }]
        }
      }
    }
  })]
}
