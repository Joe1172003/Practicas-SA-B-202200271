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

{{/* El Job que corre un script de k6 contra la version nueva. Lo usan los tres
     AnalysisTemplate. Uso: dict "raiz" . "script" "humo" "env" (lista de variables) */}}
{{- define "gateway.jobPrueba" -}}
{{- $v := .raiz.Values -}}
# Sin reintentos: si la prueba falla una vez, el canary se revierte.
backoffLimit: 0
activeDeadlineSeconds: {{ $v.pruebas.limiteSegundos }}
template:
  metadata:
    labels:
      # Con esta etiqueta la NetworkPolicy del gateway lo deja entrar.
      app.kubernetes.io/name: pruebas-{{ .raiz.Chart.Name }}
      app.kubernetes.io/part-of: sa-p8
  spec:
    restartPolicy: Never
    # k6 no le habla a la API de Kubernetes: no necesita credenciales.
    automountServiceAccountToken: false
    securityContext:
      {{- include "sa.seguridadPod" (dict "uid" 12345) | nindent 6 }}
    containers:
      - name: k6
        image: {{ $v.pruebas.imagen | quote }}
        args: ["run", "--no-color", "/pruebas/{{ .script }}.js"]
        env:
          # El Service que solo apunta a los Pods de la version nueva.
          - name: BASE
            value: "http://{{ .raiz.Chart.Name }}-canary:{{ $v.puerto }}"
          {{- with .env }}
          {{- toYaml . | nindent 10 }}
          {{- end }}
        securityContext:
          {{- include "sa.seguridadContenedor" . | nindent 10 }}
        resources:
          requests:
            cpu: {{ $v.pruebas.recursos.requests.cpu | quote }}
            memory: {{ $v.pruebas.recursos.requests.memoria | quote }}
          limits:
            cpu: {{ $v.pruebas.recursos.limits.cpu | quote }}
            memory: {{ $v.pruebas.recursos.limits.memoria | quote }}
        volumeMounts:
          - name: pruebas
            mountPath: /pruebas
            readOnly: true
          - name: temporal
            mountPath: /tmp
    volumes:
      - name: pruebas
        configMap:
          name: {{ .raiz.Chart.Name }}-pruebas
      - name: temporal
        emptyDir: {}
{{- end -}}
