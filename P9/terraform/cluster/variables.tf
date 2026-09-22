variable "proyecto" {
  description = "Proyecto de GCP donde vive todo."
  type        = string
  default     = "sa-p6-202200271"
}

variable "region" {
  description = "Region del proyecto."
  type        = string
  default     = "us-central1"
}

# Zonal y no regional: el plano de control de un cluster zonal entra en la
# capa gratuita de GKE.
variable "zona" {
  description = "Zona del cluster."
  type        = string
  default     = "us-central1-a"
}

variable "nombre_cluster" {
  description = "Nombre del cluster GKE."
  type        = string
  default     = "sa-p9"
}

# Tres nodos y no dos: con tres, drenar uno deja capacidad de sobra para que
# los Pods se reacomoden, que es la prueba de perdida de nodo de la P9.
variable "nodos" {
  description = "Cantidad de nodos del pool."
  type        = number
  default     = 3
}

variable "tipo_nodo" {
  description = "Tipo de maquina de cada nodo."
  type        = string
  default     = "e2-standard-2"
}

variable "disco_nodo" {
  description = "Disco de cada nodo en GB."
  type        = number
  default     = 30
}

variable "namespace_plataforma" {
  description = "Namespace donde ArgoCD despliega los microservicios."
  type        = string
  default     = "sa-p8"
}

# Los dos repositorios que ArgoCD tiene permitido leer. Son publicos, asi que
# ArgoCD no necesita credenciales de GitHub.
variable "repo_codigo" {
  description = "Repositorio de codigo: de aca salen los charts."
  type        = string
  default     = "https://github.com/Joe1172003/Practicas-SA-B-202200271.git"
}

variable "repo_gitops" {
  description = "Repositorio GitOps: que version corre de cada componente."
  type        = string
  default     = "https://github.com/Joe1172003/sa-p8-gitops.git"
}

# Se enciende en la Fase 4, cuando el repositorio GitOps ya tiene las apps de
# plataforma y la llave de Sealed Secrets esta repuesta.
variable "crear_raiz" {
  description = "Crear la aplicacion raiz (app of apps) de ArgoCD."
  type        = bool
  default     = false
}
