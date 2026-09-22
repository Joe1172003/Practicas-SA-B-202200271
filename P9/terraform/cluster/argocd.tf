# ArgoCD es lo ultimo que instala Terraform. De aca en adelante, todo lo demas
# (herramientas incluidas) lo despliega ArgoCD leyendo el repositorio GitOps.
# Ese es el limite que pide la P9: Terraform hace el cluster y ArgoCD, el
# app-of-apps hace el resto.

locals {
  cluster_local = "https://kubernetes.default.svc"
  repo_argo     = "https://argoproj.github.io/argo-helm"
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = local.repo_argo
  chart      = "argo-cd"
  version    = "10.9.0" # ArgoCD v3.5.2
  namespace  = kubernetes_namespace_v1.argocd.metadata[0].name

  create_namespace = false
  wait             = true
  timeout          = 900

  values = [yamlencode({
    # Sin login con GitHub (dex) ni avisos por correo (notifications): dos Pods
    # menos. No uso ApplicationSets: cada componente es un archivo del repo.
    dex            = { enabled = false }
    notifications  = { enabled = false }
    applicationSet = { replicas = 0 }

    configs = {
      params = {
        # La consola se abre con port-forward, que ya va cifrado por el API
        # server.
        "server.insecure" = true
      }
    }

    controller = {
      resources = {
        requests = { cpu = "50m", memory = "256Mi" }
        limits   = { cpu = "500m", memory = "768Mi" }
      }
    }
    repoServer = {
      resources = {
        requests = { cpu = "25m", memory = "128Mi" }
        limits   = { cpu = "500m", memory = "512Mi" }
      }
    }
    server = {
      resources = {
        requests = { cpu = "20m", memory = "96Mi" }
        limits   = { cpu = "300m", memory = "256Mi" }
      }
    }
    redis = {
      resources = {
        requests = { cpu = "10m", memory = "32Mi" }
        limits   = { cpu = "200m", memory = "128Mi" }
      }
    }
  })]
}

# Lo que ArgoCD tiene permitido hacer, y la aplicacion raiz. Release aparte
# porque los tipos AppProject y Application los crea el chart de arriba.
resource "helm_release" "argocd_apps" {
  name       = "argocd-apps"
  repository = local.repo_argo
  chart      = "argocd-apps"
  version    = "2.0.5"
  namespace  = helm_release.argocd.namespace

  depends_on = [helm_release.argocd]

  values = [yamlencode({
    projects = {
      # Los microservicios. Solo leen mis dos repos y solo despliegan en sa-p8.
      (var.namespace_plataforma) = {
        namespace   = "argocd"
        description = "Microservicios de la plataforma"
        sourceRepos = [var.repo_codigo, var.repo_gitops]
        destinations = [{
          server    = local.cluster_local
          namespace = var.namespace_plataforma
        }]
        # Esto ya lo puso Terraform en el namespace. Si un chart lo trae,
        # ArgoCD se niega en vez de pisarlo.
        namespaceResourceBlacklist = [
          { group = "", kind = "ResourceQuota" },
          { group = "", kind = "LimitRange" },
          { group = "", kind = "ServiceAccount" },
          { group = "rbac.authorization.k8s.io", kind = "Role" },
          { group = "rbac.authorization.k8s.io", kind = "RoleBinding" },
        ]
      }

      # La raiz solo puede crear Applications en argocd, nada mas.
      raiz = {
        namespace   = "argocd"
        description = "App of apps que lee la carpeta apps del repo GitOps"
        sourceRepos = [var.repo_gitops]
        destinations = [{
          server    = local.cluster_local
          namespace = "argocd"
        }]
        namespaceResourceWhitelist = [
          { group = "argoproj.io", kind = "Application" },
        ]
      }

      # Las politicas de Kyverno son del cluster entero (ClusterPolicy).
      politicas = {
        namespace   = "argocd"
        description = "Politicas de admision de Kyverno"
        sourceRepos = [var.repo_codigo, var.repo_gitops]
        destinations = [{
          server    = local.cluster_local
          namespace = "kyverno"
        }]
        clusterResourceWhitelist = [
          { group = "kyverno.io", kind = "ClusterPolicy" },
        ]
        namespaceResourceBlacklist = [
          { group = "*", kind = "*" },
        ]
      }

      # Nuevo en la P9: las herramientas de la plataforma (sealed-secrets,
      # ingress-nginx, argo-rollouts, kyverno y velero). Instalan charts de
      # terceros y crean objetos de cluster, por eso van en su propio proyecto
      # y no en el de los microservicios.
      plataforma = {
        namespace   = "argocd"
        description = "Herramientas de la plataforma instaladas por GitOps"
        sourceRepos = ["*"]
        destinations = [{
          server    = local.cluster_local
          namespace = "*"
        }]
        clusterResourceWhitelist = [
          { group = "*", kind = "*" },
        ]
      }
    }

    # La raiz se crea recien cuando el repositorio GitOps tiene las apps de
    # plataforma y la llave de Sealed Secrets esta repuesta (Fases 3 y 4). Si
    # se creara antes, ArgoCD intentaria desplegar los microservicios en un
    # cluster sin Rollouts, sin Kyverno y sin forma de descifrar los secretos.
    applications = var.crear_raiz ? {
      raiz = {
        namespace = "argocd"
        project   = "raiz"
        source = {
          repoURL        = var.repo_gitops
          targetRevision = "main"
          path           = "apps"
          # Recursivo, a diferencia de la P8: asi lee tambien apps/plataforma,
          # la subcarpeta con las herramientas. El cluster viejo (sa-p6) no es
          # recursivo, asi que ignora esa subcarpeta mientras conviven.
          directory = { recurse = true }
        }
        destination = {
          server    = local.cluster_local
          namespace = "argocd"
        }
        syncPolicy = {
          automated = { prune = true, selfHeal = true }
        }
      }
    } : {}
  })]
}
