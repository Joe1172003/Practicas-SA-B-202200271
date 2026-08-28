{{/* Plantillas reutilizables. Los subcharts tambien las usan: Helm junta todo antes de renderizar. */}}

{{/* Nombre completo: junta release y componente para que dos releases del mismo chart no choquen. */}}
{{- define "sa-platform.nombre" -}}
{{- printf "%s-%s" .raiz.Release.Name .componente | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Etiquetas estandar de Kubernetes, para agrupar y filtrar objetos. */}}
{{- define "sa-platform.etiquetas" -}}
app.kubernetes.io/name: {{ .componente }}
app.kubernetes.io/instance: {{ .raiz.Release.Name }}
app.kubernetes.io/managed-by: {{ .raiz.Release.Service }}
app.kubernetes.io/part-of: sa-platform
{{- end -}}

{{/* Subconjunto que no cambia entre versiones: Kubernetes prohibe modificar el selector de un Deployment ya creado. */}}
{{- define "sa-platform.selector" -}}
app.kubernetes.io/name: {{ .componente }}
app.kubernetes.io/instance: {{ .raiz.Release.Name }}
{{- end -}}

{{/* Nombre del ConfigMap compartido, en un solo lugar. */}}
{{- define "sa-platform.configMap" -}}
{{- printf "%s-config" .raiz.Release.Name -}}
{{- end -}}

{{/* URL de Postgres. El host se calcula porque solo se conoce al instalar, con el nombre del release. */}}
{{- define "sa-platform.urlPostgres" -}}
{{- $bd := .raiz.Values.global.postgres -}}
{{- printf "postgresql://%s:%s@%s-postgres:%v/%s" $bd.usuario $bd.password .raiz.Release.Name $bd.puerto .baseDatos -}}
{{- end -}}

{{/* URL de RabbitMQ. Lleva credenciales adentro, por eso solo se usa dentro de Secrets. */}}
{{- define "sa-platform.urlRabbit" -}}
{{- $r := .raiz.Values.global.rabbitmq -}}
{{- $clave := required "Falta global.rabbitmq.password: pasalo con -f values.secretos.yaml" $r.password -}}
{{- printf "amqp://%s:%s@%s-rabbitmq:%v" $r.usuario $clave .raiz.Release.Name $r.puerto -}}
{{- end -}}

{{/* Hash de la config compartida: al cambiar, el Deployment ve otra plantilla y reinicia los Pods solo. */}}
{{- define "sa-platform.checksumConfig" -}}
{{- printf "%s|%s" (toYaml .raiz.Values.global.configuracion) .raiz.Values.global.entorno | sha256sum -}}
{{- end -}}

{{/* Las tres probes de los microservicios HTTP, identicas salvo el puerto. Uso: dict "puerto" .Values.puerto */}}
{{- define "sa-platform.probesHttp" -}}
{{/* startup protege el arranque: hasta 60s para que NestJS levante TypeORM y conecte a Postgres. */}}
startupProbe:
  httpGet:
    path: /health
    port: {{ .puerto }}
  periodSeconds: 2
  failureThreshold: 30
{{/* readiness decide si el Service le manda trafico. Falla rapido para sacarlo de rotacion enseguida. */}}
readinessProbe:
  httpGet:
    path: /health
    port: {{ .puerto }}
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
{{/* liveness decide si hay que matarlo. Va mas holgada: reiniciar por una lentitud pasajera empeora las cosas. */}}
livenessProbe:
  httpGet:
    path: /health
    port: {{ .puerto }}
  periodSeconds: 20
  timeoutSeconds: 5
  failureThreshold: 3
{{- end -}}

{{/* maxUnavailable 0 exige que el Pod nuevo este listo antes de bajar el viejo: es lo que da el upgrade sin caida. */}}
{{- define "sa-platform.rollingUpdate" -}}
type: RollingUpdate
rollingUpdate:
  maxUnavailable: 0
  maxSurge: 1
{{- end -}}

{{/* Seguridad a nivel de Pod: quien es el proceso. Uso: dict "uid" 1000 */}}
{{- define "sa-platform.seguridadPod" -}}
{{/* runAsNonRoot rechaza el Pod si la imagen corre como root; runAsUser fija cual usuario sin privilegios. */}}
runAsNonRoot: true
runAsUser: {{ .uid }}
runAsGroup: {{ .uid }}
{{/* fsGroup hace que los volumenes montados pertenezcan a ese grupo, si no el proceso no podria escribir. */}}
fsGroup: {{ .uid }}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{/* Seguridad a nivel de contenedor: que puede hacer el proceso una vez adentro. */}}
{{- define "sa-platform.seguridadContenedor" -}}
{{/* Impide que el proceso gane mas permisos de los que arranco, aunque el binario tenga setuid. */}}
allowPrivilegeEscalation: false
{{/* Sistema de archivos de solo lectura: si alguien entra, no puede dejar nada escrito. */}}
readOnlyRootFilesystem: true
capabilities:
  drop:
    - ALL
{{- end -}}
