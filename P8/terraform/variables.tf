variable "kubeconfig" {
  description = "Archivo con el acceso al cluster, el mismo que usa kubectl."
  type        = string
  default     = "~/.kube/config"
}

# Fijar el contexto evita aplicar el plano sobre minikube por equivocacion.
variable "contexto" {
  description = "Contexto del kubeconfig que apunta al GKE."
  type        = string
  default     = "gke_sa-p6-202200271_us-central1-a_sa-p6"
}

variable "namespace_plataforma" {
  description = "Namespace donde ArgoCD va a desplegar los microservicios."
  type        = string
  default     = "sa-p8"
}

# Es mi correo personal y el repositorio es publico: el valor real va en
# terraform.tfvars, que no se sube. sensitive lo oculta en la salida del plan.
variable "usuario_consola" {
  description = "Cuenta de Google con acceso de administrador desde la consola de GCP."
  type        = string
  sensitive   = true
}
