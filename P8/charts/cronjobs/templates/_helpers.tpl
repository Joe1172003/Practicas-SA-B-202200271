{{/* Etiquetas de un cronjob. name es bitacora o resumen, no cronjobs: con ese
     nombre los encuentran la NetworkPolicy de postgres y la de rabbitmq.
     Uso: dict "raiz" $ "componente" "bitacora" */}}
{{- define "cron.etiquetas" -}}
app.kubernetes.io/name: {{ .componente }}
app.kubernetes.io/part-of: sa-p8
app.kubernetes.io/version: {{ .raiz.Values.imagen.etiqueta | quote }}
app.kubernetes.io/managed-by: {{ .raiz.Release.Service }}
{{- end -}}

{{/* La imagen completa. Frena aca si falta la version o si es latest.
     Uso: dict "raiz" $ "repositorio" .Values.bitacora.repositorio */}}
{{- define "cron.imagen" -}}
{{- $etiqueta := required "Falta imagen.etiqueta: la version la fija el repositorio GitOps" .raiz.Values.imagen.etiqueta -}}
{{- if eq $etiqueta "latest" -}}
{{- fail "La etiqueta latest esta prohibida: usa una version semantica" -}}
{{- end -}}
{{- printf "%s:%s" .repositorio $etiqueta -}}
{{- end -}}

{{/* Seguridad del Pod: el proceso corre con este usuario, nunca como root. */}}
{{- define "cron.seguridadPod" -}}
runAsNonRoot: true
runAsUser: {{ .uid }}
runAsGroup: {{ .uid }}
fsGroup: {{ .uid }}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{/* Seguridad del contenedor: sin escalar privilegios y con el disco en solo lectura. */}}
{{- define "cron.seguridadContenedor" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop:
    - ALL
{{- end -}}
