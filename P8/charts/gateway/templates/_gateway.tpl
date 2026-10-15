{{/* El Pod del gateway. Lo usan el Deployment (dev) y el Rollout (prod): asi
     los dos corren exactamente lo mismo y solo cambia como se reemplaza. */}}
{{- define "gateway.plantillaPod" -}}
metadata:
  labels:
    {{- include "sa.etiquetas" . | nindent 4 }}
  annotations:
    # Si cambia la configuracion cambia este hash y los Pods se reemplazan solos.
    checksum/config: {{ toYaml .Values.configuracion | sha256sum }}
spec:
  # La cuenta la crea Terraform con permiso de leer solo gateway-config.
  serviceAccountName: {{ .Chart.Name }}
  affinity:
    {{- include "sa.antiafinidad" . | nindent 4 }}
  securityContext:
    {{- include "sa.seguridadPod" (dict "uid" 1000) | nindent 4 }}
  containers:
    - name: {{ .Chart.Name }}
      image: {{ include "sa.imagen" . | quote }}
      imagePullPolicy: {{ .Values.imagen.politicaDescarga }}
      ports:
        - name: http
          containerPort: {{ .Values.puerto }}
      envFrom:
        # Sin Secret: el gateway no toca la base ni firma tokens.
        - configMapRef:
            name: {{ .Chart.Name }}-config
      env:
        - name: PORT
          value: {{ .Values.puerto | quote }}
        # /health la muestra: la prueba de humo del canary la compara.
        - name: VERSION_APP
          value: {{ .Values.imagen.etiqueta | quote }}
        {{- include "sa.telemetria" . | nindent 8 }}
      securityContext:
        {{- include "sa.seguridadContenedor" . | nindent 8 }}
      {{- include "sa.probesHttp" (dict "puerto" .Values.puerto) | nindent 6 }}
      volumeMounts:
        # Unico punto escribible: Node necesita /tmp aunque la app no escriba archivos.
        - name: temporal
          mountPath: /tmp
      resources:
        requests:
          cpu: {{ .Values.recursos.requests.cpu | quote }}
          memory: {{ .Values.recursos.requests.memoria | quote }}
        limits:
          cpu: {{ .Values.recursos.limits.cpu | quote }}
          memory: {{ .Values.recursos.limits.memoria | quote }}
  volumes:
    - name: temporal
      emptyDir: {}
{{- end -}}
