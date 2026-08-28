# Comandos

## 1. Comandos para levantar el entorno desde cero

```powershell
# 1. Arrancar Docker Desktop, esperar a que responda
docker info

# 2. Arrancar el clúster Nota: despues basta con "minikube start"
minikube start --driver=docker --cni=calico --memory=4096 --cpus=4

# 3. Habilitar addons Nota: una sola vez, quedan guardados en el perfil
minikube addons enable ingress
minikube addons enable metrics-server

# 4. Construir las 5 imagenes desde el codigo de la P4
docker compose -f P4/docker-compose.yml build

# 5. Cargarlas dentro de minikube (su almacen de imagenes es aparte del de Docker Desktop)
minikube image load p4-gateway:latest
minikube image load p4-auth:latest
minikube image load p4-productos:latest
minikube image load p4-ordenes:latest
minikube image load p4-notificaciones:latest
minikube image load postgres:15-alpine
minikube image load bitnamilegacy/rabbitmq:4.1.3-debian-12-r1

# 6. Resolver dependencias del chart. 
# Descarga postgres (local) y rabbitmq (de Bitnami) y genera/actualiza Chart.lock
helm dependency update ./P5/charts/sa-platform

# 7. Crear el archivo de credenciales (una sola vez). Nota: no se versiona.
#  Copiar values.example.yaml, renombrarlo y reemplazar los CAMBIAME.
copy P5\charts\sa-platform\values.example.yaml P5\charts\sa-platform\values.secretos.yaml

# 8. Validar antes de instalar
helm lint ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml -f ./P5/charts/sa-platform/values.secretos.yaml

# 9. Instalar (o actualizar si el release ya existe)
helm install sa-p5 ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml -f ./P5/charts/sa-platform/values.secretos.yaml

# Si ya existe:
helm upgrade sa-p5 ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml -f ./P5/charts/sa-platform/values.secretos.yaml

# 10. Abrir el acceso por Ingress. EN UNA TERMINAL APARTE Y COMO ADMINISTRADOR,
minikube tunnel
```

### Sobre los `values.secretos.yaml`

En `values.yaml` las contraseñas y llaves quedan vacías a propósito. Si me olvido
de pasar este archivo aparte, el chart no instala nada: `required` corta la
instalación con un mensaje que dice cuál falta.

El archivo de verdad está en `.gitignore` y nunca sube al repo. Lo que sí subo es
`values.example.yaml`, que tiene la misma estructura pero con puros CAMBIAME esto es solo para ejemplo.

### Sobre `minikube tunnel`

Esto me hace falta por correr minikube sobre Docker en Windows. El clúster vive
dentro de un contenedor y su red (`192.168.49.0/24`) no se alcanza desde mi
máquina, así que el túnel abre esa ruta y le presta el puerto 80. En un clúster
de verdad el Ingress Controller tendría IP pública y nada de esto existiria.

Pide permisos de administrador porque el 80 está por debajo de 1024.
Para esto cree lo que es  el archivo `C:\Windows\System32\drivers\etc\hosts` necesita esta línea, una sola vez. No se borra al reiniciar:

```
127.0.0.1 sa-p5.local
```

Verificacion:

```powershell
ping sa-p5.local                                  # debe responder 127.0.0.1
Invoke-RestMethod -Uri "http://sa-p5.local/health"  # con el tunnel corriendo
```

---

## 2. Comandos para ver pod, deployments, services, secret, configmap entre otros

### ver pods
```powershell
kubectl get pods -n sa-p5
```

### ver statefulset o pvc
```powershell
kubectl get statefulset,pvc -n sa-p5
```

#### ver servicios
```powershell
kubectl get svc -n sa-p5
```

### ver configmap, secretos
```powershell
kubectl get configmap,secret -n sa-p5
```

### ver el namespace
```powershell
kubectl get namespace sa-p5
```
> Nota: lo crea el propio chart en `templates/namespace.yaml`. Nunca corrí un `kubectl create namespace`.

### para ver mis upgrade y mis rollback

```powershell
helm list -A
```

```powershell
helm history sa-p5
```

## 3. Probar los cronjobs 

### Ver que existen y su configuración

```powershell
kubectl get cronjob -n sa-p5
```
Me muestra el horario, si está suspendido y cuándo corrió la última vez.

```powershell
kubectl describe cronjob sa-p5-bitacora -n sa-p5
```
Este me da todo junto: `Concurrency Policy: Forbid`, los límites de historial y
el `backoffLimit`.

### Forzar una ejecución sin esperar el horario

Para probarlo no quiero quedarme esperando 2 o 10 minutos, así que lo disparo a
mano:

```powershell
kubectl create job prueba-bitacora --from=cronjob/sa-p5-bitacora -n sa-p5
kubectl create job prueba-resumen --from=cronjob/sa-p5-resumen -n sa-p5
```

### Ver los logs de esa ejecución

```powershell
kubectl logs -n sa-p5 job/prueba-bitacora
kubectl logs -n sa-p5 job/prueba-resumen
```
En el primero veo la fila insertada con la hora en `-06:00`. En el segundo, el
resumen ya agrupado por hora.

### Verificar los datos directo en la base

```powershell
kubectl exec -n sa-p5 sa-p5-postgres-0 -- psql -U postgres -d db_bitacora -c "SELECT * FROM bitacora ORDER BY id DESC LIMIT 5;"
```

### Verificar que el resumen llegó a RabbitMQ y se consumió

```powershell
kubectl logs -n sa-p5 deploy/sa-p5-notificaciones --tail=10
kubectl exec -n sa-p5 sa-p5-postgres-0 -- psql -U postgres -d db_notificaciones -c "SELECT * FROM notificaciones WHERE tipo='resumen_bitacora' ORDER BY id DESC LIMIT 3;"
```

### Ver el historial de ejecuciones automáticas (las reales, cada 2/10 min)

```powershell
kubectl get jobs -n sa-p5
```

Los que se llaman `sa-p5-bitacora-XXXXXXXX` no los creé yo, los dispara el
CronJob solo. Nunca pasan de 3 por el `successfulJobsHistoryLimit`: cuando
aparece el cuarto, Kubernetes borra el más viejo.

### Limpiar los Jobs de prueba después

```powershell
kubectl delete job prueba-bitacora prueba-resumen -n sa-p5
```

### Demostrar `backoffLimit` - reintentos ante fallo

Apago RabbitMQ un rato y fuerzo el cronjob de resumen. Como no puede publicar,
falla y ahí se ven los reintentos.

```powershell
kubectl scale statefulset sa-p5-rabbitmq -n sa-p5 --replicas=0
kubectl create job prueba-fallo --from=cronjob/sa-p5-resumen -n sa-p5
kubectl get pods -n sa-p5 -l job-name=prueba-fallo -w
```
Con `backoffLimit: 2` salen hasta 3 Pods: el original y dos reintentos, todos
fallando mientras el broker esté abajo. Después lo levanto y limpio:
```powershell
kubectl scale statefulset sa-p5-rabbitmq -n sa-p5 --replicas=1
kubectl delete job prueba-fallo -n sa-p5
```

---

## 4. Prueba de carga con k6

El script está en `P5/carga/k6-carga.js`. Sube la concurrencia por escalones, de
20 a 60 y después a 120 usuarios virtuales, para darle tiempo al HPA de reaccionar.

### Ejecutarlo

Lo corro dentro del clúster, así no tengo que instalar k6 en Windows ni depender
del túnel:

```powershell
Get-Content P5/carga/k6-carga.js | kubectl run k6 -n default --rm -i --image=grafana/k6:0.49.0 --restart=Never -- run -
```

Ojo con la ruta: es relativa, así que hay que estar parado en la raíz del
proyecto. Si lo corro desde otra carpeta, `Get-Content` no encuentra el archivo.

En otra terminal, para ver el escalado en vivo:

```powershell
kubectl get hpa -n sa-p5 -w
kubectl get pods -n sa-p5 -l app.kubernetes.io/name=gateway -w
```

### Lo que dio

| Métrica | Valor |
|---|---|
| Peticiones totales | 106,853 |
| Peticiones por segundo | 508.64 RPS |
| Latencia p95 | 92.87 ms |
| Latencia promedio | 16.59 ms |
| Tasa de error | 0.00 % |
| Concurrencia máxima | 120 usuarios virtuales |

### Cómo escaló

```
Antes de la carga : cpu:   2%/30%   a  1 replica
Durante el pico   : cpu: 522%/30%   a  3 replicas
Al cesar la carga : cpu:   2%/30%   a  3 replicas (ventana de estabilizacion)
60s despues       : cpu:   2%/30%   a  1 replica
```

---

## 5. Ciclo de vida con Helm: upgrade y rollback (requisito A)

### Las versiones publicadas

| Revisión | Chart | App | Qué pasó |
|---|---|---|---|
| 19 | `0.4.0` | 1.2.0 | Upgrade con un cambio real de configuración |
| 20 | `0.5.0` | 1.3.0 | Versión rota a propósito (imagen inexistente) |
| 21 | `0.4.0` | 1.2.0 | `Rollback to 19` |

```powershell
helm history sa-p5
```

### Provocar el fallo y hacer rollback

Subo la `version` del chart y apunto el gateway a una imagen que no existe:

```yaml
# Chart.yaml
version: 0.5.0
appVersion: "1.3.0"

# values.yaml, bloque gateway
etiqueta: 9.9.9-inexistente
```

```powershell
helm upgrade sa-p5 ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml -f ./P5/charts/sa-platform/values.secretos.yaml
kubectl get pods -n sa-p5 -l app.kubernetes.io/name=gateway
```

El pod nuevo se queda en `ErrImageNeverPull` y el viejo sigue `1/1 Running`. Lo
interesante es que el servicio nunca dejó de responder `HTTP 200`: Kubernetes no
mata el pod bueno hasta que el nuevo pase su readiness, y como nunca pasó, el
despliegue se quedó atascado sin tumbar nada. Un deploy fallido y cero caída.

```powershell
helm rollback sa-p5 19
helm history sa-p5
```

---

## 6. Comandos de diagnóstico usados seguido

```powershell
# Logs de un Deployment (toma el pod actual solo)
kubectl logs -n sa-p5 deploy/sa-p5-auth

# Logs de un Pod puntual (StatefulSet, o cuando el Deployment tiene mas de un pod)
kubectl logs -n sa-p5 sa-p5-postgres-0

# Ejecutar un comando dentro de un contenedor corriendo
kubectl exec -n sa-p5 sa-p5-postgres-0 -- psql -U postgres -c "\l"

# Forzar que Kubernetes recree un pod (util cuando quedo colgado en un
# estado transitorio, como CrashLoopBackOff por una carrera de arranque)
kubectl delete pod -n sa-p5 <nombre-del-pod>

# Ver el YAML final que Helm va a aplicar, SIN tocar el cluster
helm template sa-p5 ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml

# Ver el YAML de un solo archivo de plantilla
helm template sa-p5 ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml --show-only charts/postgres/templates/statefulset.yaml

# Probar el flujo asincrono a mano (el 3000 del host lo ocupa el compose de
# P4, por eso el 3900 local)
kubectl port-forward -n sa-p5 svc/sa-p5-gateway 3900:3000
kubectl exec -n sa-p5 sa-p5-rabbitmq-0 -c rabbitmq -- rabbitmqctl list_queues name messages durable

# Simular el consumidor caido
kubectl scale deploy/sa-p5-notificaciones -n sa-p5 --replicas=0
# levartar el consumidor caido
kubectl scale deploy/sa-p5-notificaciones -n sa-p5 --replicas=1
```

## Para ver mi cola de mensajes
```
kubectl exec -n sa-p5 sa-p5-postgres-0 -- psql -U postgres -d db_notificaciones -c "SELECT * FROM notificaciones ORDER BY id DESC LIMIT 10;"
```