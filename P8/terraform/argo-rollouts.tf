# Argo Rollouts: el controlador que reparte el trafico del canary y corre las
# pruebas de cada paso. ArgoCD aplica el Rollout; Argo Rollouts decide si la
# version nueva avanza o se revierte.
resource "helm_release" "argo_rollouts" {
  name       = "argo-rollouts"
  repository = local.repo_argo
  chart      = "argo-rollouts"
  version    = "2.43.1" # Argo Rollouts v1.10.0, la misma version de mi plugin de kubectl
  namespace  = kubernetes_namespace_v1.herramientas["argo-rollouts"].metadata[0].name

  create_namespace = false
  wait             = true

  values = [yamlencode({
    controller = {
      # El chart trae 2 para alta disponibilidad. En este cluster alcanza con 1:
      # si se cae, Kubernetes lo levanta y el canary sigue donde quedo.
      replicas = 1
      resources = {
        requests = { cpu = "25m", memory = "64Mi" }
        limits   = { cpu = "300m", memory = "256Mi" }
      }
    }
    # Sin dashboard web: sigo el canary con el plugin de kubectl.
    dashboard = { enabled = false }
  })]
}
