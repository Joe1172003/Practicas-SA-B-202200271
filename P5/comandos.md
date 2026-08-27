# Comandos — Práctica 5

Notas de trabajo, no la documentación final (esa se hace aparte). Sirve para
no perder el hilo de qué comando hace qué y qué llevamos construido.

---

## 1. Qué llevamos hecho (resumen por fase)

| Fase | Contenido | Estado |
|---|---|---|
| 0 | minikube con `--cni=calico`, addons `ingress` y `metrics-server`, Helm bajado a 3.20.0 | ✅ |
| 1 | P4 modificado en sitio: RabbitMQ agregado al `docker-compose.yml`, Auth/Ordenes publican por `amqplib`, Notificaciones pasó a consumidor puro con `pika`, los 5 Dockerfiles corren no-root | ✅ |
| 2 | Primer `helm install`: namespace `sa-p5` creado por el chart, `_helpers.tpl` con los primeros named templates, subchart `gateway` | ✅ |
| 3 | Subcharts de `auth`, `productos`, `ordenes`, `notificaciones`. ConfigMap compartido, un Secret por componente, anotación `checksum/config`, `values-dev.yaml`/`values-prod.yaml`/`values.example.yaml` | ✅ |
| 4 | Subchart `postgres`: StatefulSet + PVC + Service headless, script de init con `range` creando 5 bases. Evidencia de persistencia tras borrar el pod | ✅ |
| 5 | RabbitMQ como dependencia **externa** (chart de Bitnami), con imagen redirigida a `bitnamilegacy` y `namespaceOverride: sa-p5`. Evidencia del flujo asíncrono y de acumulación sin pérdida con el consumidor caído | ✅ |
| 6 | Ingress + NetworkPolicies |✅ |
| 7 | Probes, HPA, ResourceQuota, LimitRange, PDB, RollingUpdate sin downtime | ⏳ Pendiente |
| 8 | RBAC + `securityContext` no-root | ⏳ Pendiente |
| 9 | Los 2 cronjobs encadenados | ⏳ Pendiente |
| 10 | Carga con k6, `helm upgrade`/`rollback`/`history` | ⏳ Pendiente |

---

## 2. Comandos para levantar el entorno desde cero

```powershell
# 1. Arrancar Docker Desktop, esperar a que responda
docker info

# 2. Arrancar el clúster (primera vez, fija el perfil con estas flags;
#    despues basta con "minikube start" a secas)
minikube start --driver=docker --cni=calico --memory=4096 --cpus=4

# 3. Habilitar addons (una sola vez, quedan guardados en el perfil)
minikube addons enable ingress
minikube addons enable metrics-server

# 4. Construir las 5 imagenes desde el codigo de P4
docker compose -f P4/docker-compose.yml build

# 5. Cargarlas dentro de minikube (su almacen de imagenes es aparte del
#    de Docker Desktop)
minikube image load p4-gateway:latest
minikube image load p4-auth:latest
minikube image load p4-productos:latest
minikube image load p4-ordenes:latest
minikube image load p4-notificaciones:latest
minikube image load postgres:15-alpine
minikube image load bitnamilegacy/rabbitmq:4.1.3-debian-12-r1

# 6. Resolver dependencias del chart. Descarga postgres (local) y rabbitmq
#    (de Bitnami) y genera/actualiza Chart.lock
helm dependency update ./P5/charts/sa-platform

# 7. Crear el archivo de credenciales (una sola vez). NO se versiona.
#    Copiar values.example.yaml, renombrarlo y reemplazar los CAMBIAME.
copy P5\charts\sa-platform\values.example.yaml P5\charts\sa-platform\values.secretos.yaml

# 8. Validar antes de instalar
helm lint ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml -f ./P5/charts/sa-platform/values.secretos.yaml

# 9. Instalar (o actualizar si el release ya existe)
helm install sa-p5 ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml -f ./P5/charts/sa-platform/values.secretos.yaml
# si ya existe:
helm upgrade sa-p5 ./P5/charts/sa-platform -f ./P5/charts/sa-platform/values-dev.yaml -f ./P5/charts/sa-platform/values.secretos.yaml

# 10. Abrir el acceso por Ingress. EN UNA TERMINAL APARTE Y COMO ADMINISTRADOR,
#     dejarlo corriendo mientras se use el entorno.
minikube tunnel
```

### Sobre `values.secretos.yaml`

Las contraseñas y llaves no van en `values.yaml`: ahí quedan vacías y el chart
falla con `required` si no se pasan aparte. El archivo real está en
`.gitignore`; `values.example.yaml` documenta el formato con valores ficticios.

Es requisito de la sección 8.1 del enunciado: no puede haber credenciales
reales versionadas en el repositorio.

### Sobre `minikube tunnel`

Hace falta solo en Windows con el driver de Docker: el cluster vive dentro de un
contenedor y su red (`192.168.49.0/24`) no es alcanzable desde el anfitrion. El
tunnel abre esa ruta y le presta el puerto 80. En un cluster real el Ingress
Controller tendria IP publica y esto no existiria.

Pide permisos de administrador porque el puerto 80 esta por debajo de 1024.

El archivo `C:\Windows\System32\drivers\etc\hosts` necesita esta linea, una sola
vez (no se borra al reiniciar):

```
127.0.0.1 sa-p5.local
```

Verificacion:

```powershell
ping sa-p5.local                                  # debe responder 127.0.0.1
Invoke-RestMethod -Uri "http://sa-p5.local/health"  # con el tunnel corriendo
```

---

## 3. Qué podés ver ahora mismo en minikube

```powershell
kubectl get pods -n sa-p5
```
Los 7 Pods actuales:

| Pod | Qué es |
|---|---|
| `sa-p5-gateway-...` | Deployment, nombre con hash al azar |
| `sa-p5-auth-...` | Deployment |
| `sa-p5-productos-...` | Deployment |
| `sa-p5-ordenes-...` | Deployment |
| `sa-p5-notificaciones-...` | Deployment — consumidor puro, sin Service |
| `sa-p5-postgres-0` | **StatefulSet** — nombre fijo con índice, no hash |
| `sa-p5-rabbitmq-0` | **StatefulSet** — dependencia externa (chart de Bitnami) |

```powershell
kubectl get statefulset,pvc -n sa-p5
```
`sa-p5-postgres` (`datos-sa-p5-postgres-0`, 1Gi) y `sa-p5-rabbitmq` (`data-sa-p5-rabbitmq-0`, 1Gi). Ambos PVC sobreviven aunque borres el Pod — comprobado con Postgres.

```powershell
kubectl get svc -n sa-p5
```
- `sa-p5-gateway`, `sa-p5-auth`, `sa-p5-productos`, `sa-p5-ordenes` — `ClusterIP` normales
- `sa-p5-postgres` / `sa-p5-rabbitmq` — `ClusterIP` normal, el host que usan los microservicios
- `sa-p5-postgres-headless` / `sa-p5-rabbitmq-headless` — `ClusterIP: None`, identidad de red para el StatefulSet
- `notificaciones` no tiene Service: es consumidor puro, nadie le hace peticiones
- Ninguno es `NodePort` ni `LoadBalancer` (requisito E)

```powershell
kubectl get configmap,secret -n sa-p5
```
- `sa-p5-config` — el ConfigMap compartido (variables no sensibles)
- `sa-p5-auth-secreto`, `sa-p5-productos-secreto`, `sa-p5-ordenes-secreto`, `sa-p5-notificaciones-secreto`, `sa-p5-postgres-secreto` — un Secret por componente, cada uno con solo lo que ese componente necesita
- `sa-p5-postgres-init` — ConfigMap con el script que crea las 5 bases

```powershell
kubectl get namespace sa-p5
```
Creado por el propio chart (`templates/namespace.yaml`), no a mano.

```powershell
helm list -A
```
Un release: `sa-p5`, revisión actual 6 (namespace de release: `default`, por el problema del huevo-y-la-gallina con el namespace que el chart crea).

```powershell
helm history sa-p5
```
El historial de las 4 revisiones hechas hasta ahora — la base para la Fase 10 (`helm rollback`).

---

## 4. Comandos de diagnóstico usados seguido

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
kubectl scale deploy/sa-p5-notificaciones -n sa-p5 --replicas=1
```
