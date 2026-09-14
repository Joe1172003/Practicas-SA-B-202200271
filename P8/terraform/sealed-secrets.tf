# El controlador de Sealed Secrets: la unica pieza que tiene la llave privada
# para abrir los secretos cifrados del repo GitOps. Yo cifro con la llave
# publica desde mi maquina (kubeseal) y solo el controlador puede descifrar.
resource "helm_release" "sealed_secrets" {
  name = "sealed-secrets"
  # El proyecto se mudo de bitnami-labs a bitnami: esta es la direccion nueva.
  repository = "https://bitnami.github.io/sealed-secrets"
  chart      = "sealed-secrets"
  version    = "2.20.0" # controlador 0.40.0, la misma version de mi kubeseal
  namespace  = kubernetes_namespace_v1.herramientas["sealed-secrets"].metadata[0].name

  create_namespace = false
  wait             = true

  values = [yamlencode({
    # kubeseal busca el controlador por este nombre. Sin esto se llamaria
    # "sealed-secrets" y habria que pasarle el nombre en cada comando.
    fullnameOverride = "sealed-secrets-controller"

    # Solo descifra cuando aparece o cambia un SealedSecret: casi no trabaja.
    resources = {
      requests = { cpu = "10m", memory = "32Mi" }
      limits   = { cpu = "200m", memory = "128Mi" }
    }
  })]
}
