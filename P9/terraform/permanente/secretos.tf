# Copia de la llave de Sealed Secrets fuera del cluster.
#
# Aca solo creo el contenedor. La llave (el contenido) la carga una persona
# en la Fase 4 con gcloud, asi el valor nunca pasa por el codigo ni por Git.
# En una reconstruccion, la capa del cluster la lee y la repone antes de que
# arranque el controlador, para que los SealedSecrets del repo GitOps se
# puedan descifrar sin volver a sellarlos.
resource "google_secret_manager_secret" "llave_sealed_secrets" {
  secret_id = "sa-p9-sealed-secrets-llave"

  replication {
    auto {}
  }

  labels = {
    practica = "p9"
  }

  depends_on = [google_project_service.api]
}
