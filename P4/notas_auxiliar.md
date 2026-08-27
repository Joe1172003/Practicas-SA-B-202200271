## Notas del auxiliar — Práctica 5 (a considerar / pendientes)

> Aclaraciones puntuales dadas por el auxiliar sobre el enunciado oficial. Complementan (y en algunos puntos ajustan) los requisitos del documento base.

### 0. Nivel de conocimiento previo — cómo debe explicarme Claude

- **No tengo conocimiento previo de Kubernetes ni de Helm.** Lo único que sé es qué es un Pod, hasta ahí llega mi base.
- Por lo tanto, en cada parte de la práctica que se trabaje:
  - [ ] Antes de dar cualquier comando, dar una **breve introducción/contexto**: qué problema resuelve ese paso, qué concepto de K8s o Helm está involucrado y por qué es necesario aquí, aqui un ejemplo como si fuera un niño y despues como trabaja k8s o helm.
  - [ ] **Cada comando debe explicarse individualmente** al momento de dársemelo (qué hace cada flag/parámetro, qué resultado espero ver, por qué se usa en este punto de la práctica) — no dar bloques largos de comandos sin explicación intercalada.
  - [ ] Ir avanzando **a la par de lo que yo vaya haciendo**, paso a paso, no adelantar todo de golpe, para poder entender bien antes de seguir al siguiente punto.

- ** se trabajara con minikube** esta es la version: minikube version: v1.38.1
- **heml ya intalado esta es la version** helm version
version.BuildInfo{Version:"v4.2.4", GitCommit:"3900f434fd3ef2b84065dc04508df48f288dba00", GitTreeState:"clean", GoVersion:"go1.26.5", KubeClientVersion:"v1.36"}

- **kubetcl esta es la version** Client Version: v1.34.1

### 1. Versionado del chart (`Chart.yaml`) — ciclo `upgrade` / `rollback`

- [ ] Incrementar `version` (y `appVersion` si aplica) en `Chart.yaml` para publicar una **v2** del chart.
- [ ] Hacer un **cambio real** en algún microservicio (ej. modificar una variable de configuración o una línea de código) → `helm upgrade`.
- [ ] Para demostrar el **rollback**: provocar un fallo intencional en el código (crashear el pod, ej. excepción al iniciar o `CrashLoopBackOff`) en la nueva versión, publicarlo con `helm upgrade`, y luego ejecutar `helm rollback` a la revisión anterior estable.
- [ ] Evidenciar todo el flujo con `helm history` (mostrar las revisiones: v1 estable → v2 fallida → rollback a v1).

### 2. Estructura de `templates/` por microservicio

- La carpeta `templates/` debe organizarse **por microservicio** (subcarpeta por cada uno), tal como se ve en el repo de referencia:
  ```
  templates/
  ├── appointment-ms/
  │   └── deployment.yml
  ├── auth-ms/
  │   └── deployment.yml
  ├── esb/
  │   ├── deployment.yaml
  │   └── service.yml
  ├── nats/
  │   ├── deployment.yml
  │   └── service.yml
  ├── payment-ms/
  │   ├── deployment.yml
  │   └── service.yml
  └── user-ms/
      └── ...
  ```
- [ ] **No todos los microservicios necesitan `service.yml`.** Un Service solo se crea cuando el componente necesita comunicación con el exterior (o ser alcanzado por otro componente fuera de su propio pod) — por eso el `esb` (que es el API Gateway) sí tiene `service.yml`, mientras que `appointment-ms` y `auth-ms` en la referencia **no lo tienen intencionalmente**, no es que falte.
- [ ] Revisar caso por caso cuál microservicio realmente necesita Service (ej. si otro microservicio o el gateway le hace peticiones directas) y cuál no.

### 3. Exposición del API Gateway (Ingress) y criterio general de Services

- [ ] El **Service solo aplica a componentes que necesitan comunicación con el exterior del clúster** (o ser alcanzados por otro componente). El caso principal es el **ESB / API Gateway**: crear un **Service** (ClusterIP) para él, y que el **Ingress** apunte a ese Service (Ingress → Service → Deployment del Gateway).
- [ ] Los microservicios internos que no reciben tráfico externo ni de otros microservicios directamente **no necesitan Service** — este es el criterio a aplicar en el punto 2.

### 4. HPA — ajuste de valores para la demo

- El auxiliar indica usar valores distintos a los del enunciado original para facilitar la evidencia del escalado:
  - [ ] `minReplicas: 0`, `maxReplicas: 1` (en vez de 2–5).
  - [ ] Umbral de activación: **30 % de uso de CPU** (en vez de 70 %).
  - Motivo: con estos valores es más fácil forzar el escalado sin necesitar una carga tan alta, evitando que el pod se crashee al generar la prueba de carga.
- [ ] Dejar esta decisión documentada en el README como una desviación intencional acordada con el auxiliar (por si se pregunta en la revisión).

### 5. RollingUpdate sin downtime (`maxUnavailable: 0`)

- [ ] Durante el `helm upgrade`, debe haber un **proceso en paralelo consultando el endpoint continuamente** (ej. `while true; do curl ...; sleep 1; done` o un script simple) para demostrar que el servicio **no se cae** mientras se actualiza.
- [ ] Capturar evidencia (log/salida) de que todas las peticiones durante el upgrade respondieron correctamente (sin error 5xx ni timeouts).

### 6. Base de datos — ubicación y manejo de credenciales

- [ ] Confirmado por el auxiliar: la base de datos **puede desplegarse fuera del clúster** (servicio externo/managed), **no es obligatorio** que sea un StatefulSet dentro de Kubernetes.
- [ ] Si se usa un servicio externo, de igual forma las credenciales de conexión deben inyectarse vía **Secret** (no quemadas en el chart ni versionadas en el repo).
- [ ] Documentar esta decisión (externa vs. StatefulSet interno) y el motivo en el README.

### Deduccion de la broker
indicame cual es la mejor opcion antererio mente toda la practica esta con REST pero ahora piden un broker mira el enunciado donde indica para implemtarlo en esta practica

Cosas a no hacer los 5 microservicio ya estan en la P4 asi que no vamos a copiar esto y pasarlo a un P5 