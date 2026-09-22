# El puente entre Kubernetes y GCP para Velero.
#
# Dice: "el ServiceAccount velero-server del namespace velero puede actuar como
# la cuenta velero-sa-p9". El Pod de Velero pide un token al vuelo y respalda
# sin que exista ninguna llave JSON en el cluster ni en el repositorio.
#
# Va en esta capa y no en la permanente porque el pool de identidades
# (<proyecto>.svc.id.goog) solo existe cuando hay un cluster con Workload
# Identity encendido.
resource "google_service_account_iam_member" "velero_wi" {
  service_account_id = "projects/${var.proyecto}/serviceAccounts/${data.terraform_remote_state.permanente.outputs.cuenta_velero}"
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.proyecto}.svc.id.goog[velero/velero-server]"

  depends_on = [google_container_cluster.sa_p9]
}
