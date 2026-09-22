{{/* Etiquetas de todos los objetos. name es fijo porque lo usan los Roles de
     Terraform y las NetworkPolicies de los otros charts para encontrarlo. */}}
{{- define "sa.etiquetas" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/part-of: sa-p8
app.kubernetes.io/version: {{ .Values.imagen.etiqueta | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/* Lo que no cambia entre versiones: Kubernetes prohibe tocar el selector despues. */}}
{{- define "sa.selector" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
{{- end -}}

{{/* La imagen completa. Frena aca si falta la version o si es latest. */}}
{{- define "sa.imagen" -}}
{{- $etiqueta := required "Falta imagen.etiqueta: la version la fija el repositorio GitOps" .Values.imagen.etiqueta -}}
{{- if eq $etiqueta "latest" -}}
{{- fail "La etiqueta latest esta prohibida: usa una version semantica" -}}
{{- end -}}
{{- printf "%s:%s" .Values.imagen.repositorio $etiqueta -}}
{{- end -}}

{{/* Seguridad del Pod: el proceso corre con este usuario, nunca como root. */}}
{{- define "sa.seguridadPod" -}}
runAsNonRoot: true
runAsUser: {{ .uid }}
runAsGroup: {{ .uid }}
fsGroup: {{ .uid }}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{/* Seguridad del contenedor: sin escalar privilegios y con el disco en solo lectura. */}}
{{- define "sa.seguridadContenedor" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop:
    - ALL
{{- end -}}

{{/* Las tres probes de un servicio HTTP de NestJS. Uso: dict "puerto" .Values.puerto */}}
{{- define "sa.probesHttp" -}}
{{/* startup: hasta 60s para que NestJS conecte a sus dependencias al arrancar. */}}
startupProbe:
  httpGet:
    path: /health
    port: {{ .puerto }}
  periodSeconds: 2
  failureThreshold: 30
{{/* readiness: si falla, el Service deja de mandarle trafico enseguida. */}}
readinessProbe:
  httpGet:
    path: /health
    port: {{ .puerto }}
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
{{/* liveness: mas holgada, reiniciar por una lentitud pasajera empeora las cosas. */}}
livenessProbe:
  httpGet:
    path: /health
    port: {{ .puerto }}
  periodSeconds: 20
  timeoutSeconds: 5
  failureThreshold: 3
{{- end -}}

{{/*
Anti-afinidad: pide que las replicas de un mismo servicio caigan en nodos
distintos. Asi, si se pierde un nodo, siempre queda una viva en otro.

Es "preferred" y no "required" a proposito: con 3 nodos y un HPA que puede
llegar a 3 replicas, una regla obligatoria dejaria Pods en Pending durante un
rolling update (que crea un Pod de mas antes de bajar el viejo). Con peso 100
el planificador las separa igual, pero nunca bloquea un despliegue.
*/}}
{{- define "sa.antiafinidad" -}}
podAntiAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        topologyKey: kubernetes.io/hostname
        labelSelector:
          matchLabels:
            {{- include "sa.selector" . | nindent 12 }}
{{- end -}}
