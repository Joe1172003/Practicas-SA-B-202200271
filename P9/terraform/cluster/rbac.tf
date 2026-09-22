# Minimo privilegio, igual que en la P5: cada componente tiene su propia cuenta
# y solo puede leer (get) sus objetos, nombrados uno por uno.
locals {
  permisos = {
    gateway = [
      { recurso = "configmaps", nombre = "gateway-config" },
    ]
    auth = [
      { recurso = "configmaps", nombre = "auth-config" },
      { recurso = "secrets", nombre = "auth-secreto" },
    ]
    productos = [
      { recurso = "configmaps", nombre = "productos-config" },
      { recurso = "secrets", nombre = "productos-secreto" },
    ]
    ordenes = [
      { recurso = "configmaps", nombre = "ordenes-config" },
      { recurso = "secrets", nombre = "ordenes-secreto" },
    ]
    notificaciones = [
      { recurso = "configmaps", nombre = "notificaciones-config" },
      { recurso = "secrets", nombre = "notificaciones-secreto" },
    ]
    postgres = [
      { recurso = "configmaps", nombre = "postgres-config" },
      { recurso = "secrets", nombre = "postgres-secreto" },
    ]
    # Los cronjobs no tienen configuracion propia, solo su conexion a la base.
    bitacora = [
      { recurso = "secrets", nombre = "bitacora-secreto" },
    ]
    resumen = [
      { recurso = "secrets", nombre = "resumen-secreto" },
    ]
  }
}

resource "kubernetes_service_account_v1" "componente" {
  for_each = local.permisos

  metadata {
    name      = each.key
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = merge(local.etiquetas, { "app.kubernetes.io/name" = each.key })
  }
}

resource "kubernetes_role_v1" "componente" {
  for_each = local.permisos

  metadata {
    name      = each.key
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = merge(local.etiquetas, { "app.kubernetes.io/name" = each.key })
  }

  # Una regla por objeto. Sin resource_names podria leer cualquiera del namespace.
  dynamic "rule" {
    for_each = each.value
    content {
      api_groups     = [""]
      resources      = [rule.value.recurso]
      resource_names = [rule.value.nombre]
      verbs          = ["get"]
    }
  }
}

# Une cada cuenta con su rol. Sin esto el rol existe pero no aplica a nadie.
resource "kubernetes_role_binding_v1" "componente" {
  for_each = local.permisos

  metadata {
    name      = each.key
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = merge(local.etiquetas, { "app.kubernetes.io/name" = each.key })
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.componente[each.key].metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.componente[each.key].metadata[0].name
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
  }
}

# RabbitMQ va aparte porque sus permisos son otros: los mismos que traia su chart
# de Bitnami, que ahora no crea RBAC propio. Consulta los endpoints para
# encontrar a sus pares y registra eventos.
resource "kubernetes_service_account_v1" "rabbitmq" {
  metadata {
    name      = "rabbitmq"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = merge(local.etiquetas, { "app.kubernetes.io/name" = "rabbitmq" })
  }
}

resource "kubernetes_role_v1" "rabbitmq" {
  metadata {
    name      = "rabbitmq"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = merge(local.etiquetas, { "app.kubernetes.io/name" = "rabbitmq" })
  }

  rule {
    api_groups = [""]
    resources  = ["endpoints"]
    verbs      = ["get"]
  }

  rule {
    api_groups = [""]
    resources  = ["events"]
    verbs      = ["create"]
  }
}

resource "kubernetes_role_binding_v1" "rabbitmq" {
  metadata {
    name      = "rabbitmq"
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
    labels    = merge(local.etiquetas, { "app.kubernetes.io/name" = "rabbitmq" })
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.rabbitmq.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.rabbitmq.metadata[0].name
    namespace = kubernetes_namespace_v1.plataforma.metadata[0].name
  }
}
