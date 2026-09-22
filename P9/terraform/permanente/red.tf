# IP publica fija del ingress-nginx. Si la IP naciera con el cluster, cada
# reconstruccion traeria una IP nueva y el host <ip>.nip.io del gateway
# cambiaria. Reservada aca, sobrevive al cluster y el Service del ingress la
# vuelve a tomar.
resource "google_compute_address" "ingress" {
  name         = "sa-p9-ingress"
  region       = var.region
  address_type = "EXTERNAL"
  description  = "IP del ingress-nginx del cluster sa-p9."

  depends_on = [google_project_service.api]
}
