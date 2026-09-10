<p align="left">
Universidad San Carlos de Guatemala<br>
Facultad de Ingeniería<br>
Ingeniería en ciencias y sistemas<br>
Laboratorio de Software Avanzado

Nombre: Sergio Joel Rodas Valdez<br>
Carné: 202200271
</p>

# Práctica 7 - Integración y Despliegue Continuo (CI/CD)

Todo el ciclo que en la Practica 5 y la Practica 6 hice a mano (compilar, probar, construir
imágenes, desplegar) ahora corre solo con cada commit. El pipeline vive en
[`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml).

![Diagrama del pipeline](diagrama-pipeline.png)


# Evidencia de ejecución - pipeline 
![Evidencia de ejecucion pipeline](./Evidencia-pipeline.png)


## Qué dispara qué

No todo corre siempre. El evento decide hasta dónde llega el pipeline:

| Evento | Build | Test | Imágenes | Despliegue |
|---|:--:|:--:|:--:|:--:|
| Pull request a `main` | sí | sí | no | no |
| Push a `main` | sí | sí | sí | kind |
| Tag `v*.*.*` | sí | sí | sí | GKE |
| Botón *Run workflow* | sí | sí | sí | GKE |

Un Pull Request se valida pero no publica nada. Esa es la diferencia que evita
ensuciar el registro con imágenes de código que todavía nadie revisó.

El GKE no se despliega en cada push porque cobra por hora de nodo encendido.
Llega a producción solo cuando yo lo decido: con un tag de versión o con el
botón manual.

## Etapa 0: preparación

Calcula una sola etiqueta para toda la corrida y la deja disponible para los
demás jobs. Si viene de un tag `v1.0.0` usa `1.0.0`; si no, usa `sha-` más
los primeros 7 caracteres del commit.

Sin este paso, el job que construye la imagen y el que la despliega podrían
calcular etiquetas distintas, y el clúster terminaría pidiendo una imagen que
nunca existió.

## Etapa 1: build

Dos caminos en paralelo, porque los dos lenguajes se validan distinto.

`build-node` corre sobre los 4 servicios de NestJS a la vez, cada uno en su
propia máquina: `npm ci` y `npm run build`. Compila el TypeScript.

`build-python` valida la sintaxis de los 3 servicios de Python con
`compileall`. No los ejecuta: esos módulos leen variables de entorno al
importarse y sin base de datos ni broker reventarían con un `KeyError`.

## Etapa 2: test

`test-node` corre las pruebas de jest de los 4 servicios. Cubren la política
de renovación del JWT, el guard de sesión del gateway, el apartado de stock
de productos y la compensación de la saga de órdenes.

Cada test espera a su build. No tiene sentido probar código que ni compila.

## Etapa 3: dockerización

7 líneas en paralelo, una por imagen. Cada una construye desde su propia
carpeta y publica en GitHub Container Registry (GHCR) con varias etiquetas a la vez: la del commit, `latest`, y las de versión si el disparador fue un tag.

Todas las etiquetas apuntan a la misma imagen. El despliegue usa la del
commit, que no cambia nunca; `latest` queda solo como comodidad.

## Etapa 4: despliegue

Hay dos destinos y el evento elige cuál.

### kind, en cada push a main

`deploy-kind` levanta un clúster de Kubernetes desechable dentro del propio
runner, instala el Ingress Controller, baja las 7 imágenes de GHCR y las
carga al nodo, y las despliega con el mismo chart de Helm de la Practica 5. Al
terminar el job, el clúster se destruye.

La prueba final no es que los pods arranquen: es un `curl` al `/health` del
gateway entrando por el Ingress. Si responde `{"estado":"ok"}`, el despliegue
sirvió de verdad.

Este job no usa ningún secreto. Las credenciales del clúster desechable se
generan al vuelo con `openssl`, así que no puede fallar por configuración
faltante.

### GKE, con un tag o a mano

`deploy-gke` actualiza el clúster real de la Practica 6. No reinstala nada:
hace `helm upgrade` sobre el mismo release `sa-p6`, así Postgres y RabbitMQ
conservan sus discos y sus datos.

1. Se autentica en GCP con la llave de una service account.
2. Si el node pool está en 0 (lo apago cuando no lo uso), lo sube a 2 nodos.
3. Arma el archivo de secretos para Helm en una carpeta temporal del runner,
   fuera del repositorio.
4. Corre `helm upgrade` con los mismos valores de la Practica 6 más
   [`values-gke.yaml`](values-gke.yaml), que solo cambia el origen de las
   imágenes: antes Artifact Registry, ahora GHCR.
5. Borra el archivo de secretos, aunque el despliegue haya fallado.
6. Verifica con `rollout status` del gateway y un `curl` a la IP pública.

El comando no lleva `-n sa-p5`. En la Practica 6 instalé el release sin ese flag y quedó registrado en el namespace `default`, si el pipeline buscara en
`sa-p5`, Helm no lo encontraría e intentaría instalar de cero encima de lo
que ya corre.

Tiene una casilla opcional para escalar los nodos a 0 al terminar. Ese paso
corre aunque algo falle antes, así un despliegue roto no me deja un clúster
encendido cobrando.

## Credenciales

El workflow no tiene ninguna credencial escrita. Publicar en GHCR usa el
`GITHUB_TOKEN` que GitHub genera en cada corrida, y kind no necesita nada.
Solo el GKE usa dos secretos del repositorio:

| Secreto | Qué tiene | Dónde se usa |
|---|---|---|
| `GCP_SA_KEY` | La llave JSON de la service account `github-actions-p7` | `google-github-actions/auth` |
| `HELM_VALUES_SECRETOS` | Mi `values.secretos.yaml` en base64 | El paso que arma los secretos para Helm |

La service account tiene un solo rol, `roles/container.admin`.
`container.developer` sería más acotado, pero no alcanza: el chart crea Roles
y RoleBindings, y ese rol no puede crear objetos RBAC. Tampoco podría escalar
el node pool.

`HELM_VALUES_SECRETOS` tiene que ser el mismo archivo que usé en la Practica 6. Postgres solo lee su contraseña la primera vez que inicializa el disco: con
otra, el upgrade dejaría a auth, productos, órdenes y notificaciones sin
acceso a la base.


## Evidencia del despliegue en GKE

El historial del release muestra quién desplegó cada versión. Las revisiones
1 y 2 las hice a mano en la P6; la 3 la hizo el pipeline:

![Helm history](./heml-history.png)


![deployment imagenes](./deplyment-images.png)

La etiqueta `sha-f33f4c4` es el commit que disparó la corrida, así que se
puede rastrear qué código exacto está en producción. Postgres y RabbitMQ no
se reiniciaron durante el upgrade: Kubernetes solo reemplazó los pods cuya
imagen cambió.

## Archivos

| Archivo | Qué es |
|---|---|
| [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) | El pipeline completo |
| [`values-kind.yaml`](values-kind.yaml) | Valores de Helm para el clúster efímero |
| [`values-gke.yaml`](values-gke.yaml) | Valores de Helm para el GKE de la Practica 6 |
| [`kind/kind-config.yaml`](kind/kind-config.yaml) | Clúster de un nodo con el puerto 80 abierto |
