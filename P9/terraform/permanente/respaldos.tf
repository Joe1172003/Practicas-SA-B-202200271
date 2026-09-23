# Destino de los respaldos de Velero. Vive fuera del cluster que respalda: si
# el cluster se pierde, los respaldos siguen aca.
resource "google_storage_bucket" "velero" {
  name     = var.bucket_velero
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Nunca borrar el bucket con respaldos adentro, ni por un destroy.
  force_destroy = false

  # La retencion la maneja Velero con el TTL de cada respaldo. Esta regla es
  # solo una red de seguridad por si Velero deja algo huerfano.
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.api]
}

# Identidad de Velero en GCP. Dentro del cluster, el ServiceAccount de Velero
# se hace pasar por esta cuenta con Workload Identity, asi que no hay ninguna
# llave JSON. El enlace entre las dos se crea en la capa del cluster, porque
# necesita que exista un cluster con Workload Identity.
resource "google_service_account" "velero" {
  account_id   = "velero-sa-p9"
  display_name = "Velero de la P9"
  description  = "Respalda el cluster sa-p9 en el bucket de Velero y saca snapshots de discos."

  depends_on = [google_project_service.api]
}

# Solo los permisos de disco y snapshot que pide el plugin de GCP de Velero,
# en lugar de un rol amplio como Compute Admin.
resource "google_project_iam_custom_role" "velero" {
  role_id     = "veleroSaP9"
  title       = "Velero P9"
  description = "Snapshots de discos persistentes para Velero."
  permissions = [
    "compute.disks.get",
    "compute.disks.create",
    "compute.disks.createSnapshot",
    # Al restaurar, Velero crea el disco y le pone etiquetas. Sin este permiso
    # la restauracion queda PartiallyFailed y el PVC nunca se monta.
    "compute.disks.setLabels",
    "compute.projects.get",
    "compute.snapshots.get",
    "compute.snapshots.create",
    "compute.snapshots.useReadOnly",
    "compute.snapshots.delete",
    # Velero le pone etiquetas a cada snapshot para saber de que respaldo
    # salio. Sin este permiso el respaldo funciona igual, pero avisa
    # "Missing compute.snapshots.setLabels permission" en cada corrida.
    "compute.snapshots.setLabels",
    "compute.zones.get",
  ]
}

resource "google_project_iam_member" "velero" {
  project = var.proyecto
  role    = google_project_iam_custom_role.velero.name
  member  = "serviceAccount:${google_service_account.velero.email}"
}

# Sobre el bucket, Velero puede leer y escribir objetos, y nada mas.
resource "google_storage_bucket_iam_member" "velero" {
  bucket = google_storage_bucket.velero.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.velero.email}"
}

# Velero firma URLs para que "velero backup logs" pueda bajar archivos del
# bucket. Le doy ese permiso solo sobre su propia cuenta, no sobre todas las
# del proyecto.
resource "google_service_account_iam_member" "velero_firma" {
  service_account_id = google_service_account.velero.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.velero.email}"
}
