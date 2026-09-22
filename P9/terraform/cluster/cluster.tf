# El cluster que en la P6 cree a mano con gcloud, ahora declarado. Esta es la
# capa que se destruye en el simulacro de desastre y se vuelve a levantar con
# el bootstrap.

# Identidad de los nodos. GKE usa por defecto la cuenta de Compute Engine, que
# trae el rol Editor sobre todo el proyecto: si alguien entra a un nodo, tiene
# ese poder. Esta cuenta solo puede escribir logs y metricas.
resource "google_service_account" "nodos" {
  account_id   = "nodos-sa-p9"
  display_name = "Nodos del cluster sa-p9"
}

resource "google_project_iam_member" "nodos" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
  ])

  project = var.proyecto
  role    = each.value
  member  = "serviceAccount:${google_service_account.nodos.email}"
}

resource "google_container_cluster" "sa_p9" {
  name     = var.nombre_cluster
  location = var.zona

  # El simulacro de la Fase 7 destruye este cluster con terraform destroy. Con
  # la proteccion activada (el valor por defecto), Terraform se negaria.
  deletion_protection = false

  # GKE obliga a crear un pool con el cluster. Lo borro enseguida y uso el pool
  # declarado abajo, que puedo cambiar sin recrear el cluster.
  remove_default_node_pool = true
  initial_node_count       = 1

  release_channel {
    channel = "REGULAR"
  }

  # Dataplane V2 es el equivalente del --enable-dataplane-v2 de la P6. Sin esto
  # las NetworkPolicies se crean pero no bloquean nada.
  datapath_provider = "ADVANCED_DATAPATH"
  networking_mode   = "VPC_NATIVE"
  ip_allocation_policy {}

  # El puente para que un ServiceAccount de Kubernetes actue como una cuenta de
  # GCP. Asi Velero respalda sin ninguna llave JSON guardada.
  workload_identity_config {
    workload_pool = "${var.proyecto}.svc.id.goog"
  }

  # El driver que crea los discos persistentes de postgres y rabbitmq, y el que
  # Velero usa para sacarles snapshots.
  addons_config {
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }
}

resource "google_container_node_pool" "principal" {
  name     = "principal"
  cluster  = google_container_cluster.sa_p9.name
  location = var.zona

  node_count = var.nodos

  node_config {
    machine_type = var.tipo_nodo
    disk_size_gb = var.disco_nodo
    disk_type    = "pd-balanced"

    service_account = google_service_account.nodos.email
    # cloud-platform y el control real lo hacen los roles de arriba: es lo que
    # recomienda GKE en lugar de una lista de scopes.
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]

    # Obliga a los Pods a pedir credenciales por Workload Identity en lugar de
    # leer el servidor de metadatos del nodo.
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      practica = "p9"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Al cambiar el tipo de maquina, primero crea los nodos nuevos y despues
  # saca los viejos.
  lifecycle {
    create_before_destroy = false
  }
}
