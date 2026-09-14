# ArgoCD es el unico que aplica cambios en sa-p8. Lo instala Terraform, igual
# que el resto de la base, y queda en el namespace argocd que ya existe.

locals {
  cluster_local = "https://kubernetes.default.svc"
  repo_argo     = "https://argoproj.github.io/argo-helm"
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = local.repo_argo
  chart      = "argo-cd"
  version    = "10.9.0" # ArgoCD v3.5.2
  namespace  = kubernetes_namespace_v1.herramientas["argocd"].metadata[0].name

  # El namespace lo creo Terraform con sus etiquetas, Helm solo lo usa.
  create_namespace = false
  wait             = true
  timeout          = 600

  values = [yamlencode({
    # Entro con el usuario admin: no necesito login con GitHub (dex) ni avisos
    # por correo (notifications). Son dos Pods menos en un cluster chico.
    dex           = { enabled = false }
    notifications = { enabled = false }

    # No uso ApplicationSets: cada componente es un archivo en el repo GitOps.
    applicationSet = { replicas = 0 }

    configs = {
      params = {
        # La consola solo se abre con port-forward desde mi maquina y ese tunel
        # ya va cifrado por el API server. TLS adentro solo agregaria el aviso
        # de certificado del navegador.
        "server.insecure" = true
      }
    }

    # Requests chicos: los nodos ya tienen el 70% del CPU reservado por GKE.
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

# Lo que ArgoCD tiene permitido hacer, y la aplicacion raiz. Va en un release
# aparte porque los tipos AppProject y Application los crea el chart de arriba:
# tienen que existir antes de crear objetos de esos tipos.
resource "helm_release" "argocd_apps" {
  name       = "argocd-apps"
  repository = local.repo_argo
  chart      = "argocd-apps"
  version    = "2.0.5"
  namespace  = helm_release.argocd.namespace

  depends_on = [helm_release.argocd]

  values = [yamlencode({
    projects = {
      # Las apps de los microservicios. Solo leen mis dos repos y solo
      # despliegan en sa-p8. Sin clusterResourceWhitelist no pueden crear nada
      # a nivel de cluster (namespaces, CRDs, ClusterRoles).
      (var.namespace_plataforma) = {
        namespace   = "argocd"
        description = "Microservicios de la P8"
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
        # Sin dos puntos en description: el chart no le pone comillas y
        # romperia el YAML.
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
    }

    applications = {
      # Una sola hoja que dice "lee apps/". Para sumar un componente no toco
      # Terraform: agrego un archivo en el repo GitOps.
      raiz = {
        namespace = "argocd"
        project   = "raiz"
        source = {
          repoURL        = var.repo_gitops
          targetRevision = "main"
          path           = "apps"
        }
        destination = {
          server    = local.cluster_local
          namespace = "argocd"
        }
        # prune: si borro un archivo de apps/, ArgoCD borra esa app.
        # selfHeal: si alguien cambia algo a mano, ArgoCD lo devuelve.
        syncPolicy = {
          automated = { prune = true, selfHeal = true }
        }
      }
    }
  })]
}
