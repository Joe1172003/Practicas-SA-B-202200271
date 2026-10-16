# Definición de los SLO

Son dos promesas que un cliente puede comprobar sin saber nada de Kubernetes: que la tienda responda y que el catálogo cargue rápido. Por eso ninguna mide CPU ni Pods.

| | SLO 1: disponibilidad | SLO 2: latencia del catálogo |
|---|---|---|
| Promesa | La tienda responde sin fallar | El catálogo carga rápido |
| Indicador | Peticiones al gateway sin 5xx / peticiones al gateway | Consultas a `/graphql/productos` en 500 ms o menos / consultas a `/graphql/productos` |
| Objetivo | 99.5 % | 99 % |
| Ventana | 7 días móviles | 7 días móviles |
| Presupuesto de error | 0.5 % de las peticiones | 1 % de las consultas |
| Con el tráfico actual (~3 peticiones/s) | ~9 000 errores por semana | ~16 000 consultas lentas por semana |
| Reglas | [slo-disponibilidad.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/slo/slo-disponibilidad.yaml) | [slo-catalogo-latencia.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/slo/slo-catalogo-latencia.yaml) |

Los mido en el gateway porque es la única puerta de los clientes: lo que ve el gateway es lo que vive el usuario. No cuento las peticiones a `/health`, que son las sondas de Kubernetes, ni los 4xx, que son errores del que llama (una sesión vencida, por ejemplo).

## Por qué 99.5 % y no otro número

Partí de lo que mi sistema ya aguantó. En la P9 medí que perder el nodo de postgres deja el catálogo caído 71 segundos y que reconstruir el clúster entero toma 27 minutos. Postgres sigue siendo un punto único de fallo, y eso todavía no lo resolví.

Con 99.9 % me quedarían unos 10 minutos de caída por semana, y una sola reconstrucción ya rompe la promesa: prometerlo sería mentir. Con 99 % tendría 1 hora y 40 minutos, demasiado para una tienda; podría dejarla caída una tarde entera y seguir "cumpliendo".

99.5 % son unos 50 minutos por semana. Alcanzan para un incidente serio de postgres o para una reconstrucción, pero no para dos. Eso me obliga a tomarme en serio la segunda falla de la semana.

## Por qué 500 ms y 99 %

500 ms es más o menos donde una página deja de sentirse inmediata. Además es uno de los límites del histograma de OpenTelemetry (`le="0.5"`), así que cuento las consultas lentas exactas, sin estimar entre dos buckets.

Me quedé en 99 % y no en 99.5 % porque la latencia tiene cola larga aunque nada esté roto. Cuando un Pod se reinicia, Node compila en caliente y el pool de conexiones a postgres arranca vacío, así que las primeras consultas tardan más. Lo vi en el canary de la v2.4.1: un pico de 30 segundos, de casi 2 s, en un Pod recién creado. Ese ruido llega con cada despliegue y tiene que caber en el presupuesto.

En los 30 minutos antes de escribir esto, el 99.6 % de las consultas al catálogo respondió en menos de 500 ms. Dejé el objetivo un poco por debajo de lo que hoy logro, con margen para los despliegues.

## Por qué 7 días

Entrego la práctica cada semana, y la pregunta que me importa también es semanal: ¿cumplí esta semana lo que prometí?

El libro de SRE de Google usa ventanas de 30 días en sus ejemplos, pero 30 días no caben en mi Prometheus. La retención era de 3 días y la subí a 8 para que entrara la semana completa. Antes medí el disco: ~190 MB cada 6 horas, unos 5 GB por semana en un volumen de 10 GiB.

## Las alertas

Alerto por el ritmo al que gasto el presupuesto (*burn rate*). Un umbral instantáneo, del tipo "hay un error", me avisaría por cada tropiezo suelto. Ritmo 1 es gastar el presupuesto justo en los 7 días. Cada alerta pide dos ventanas a la vez: con la larga sé que no es un pico, y con la corta, que todavía está pasando.

| Alerta | Ritmo | Ventanas | Se agota en | Severidad |
|---|---|---|---|---|
| `SloDisponibilidadConsumoRapido` | 14.4× (más de 7.2 % de errores) | 1 h y 5 min | ~12 h | crítica |
| `SloDisponibilidadConsumoLento` | 6× (más de 3 % de errores) | 6 h y 30 min | ~28 h | advertencia |
| `SloCatalogoLatenciaConsumoRapido` | 14.4× (más de 14.4 % lentas) | 1 h y 5 min | ~12 h | crítica |
| `SloCatalogoLatenciaConsumoLento` | 6× (más de 6 % lentas) | 6 h y 30 min | ~28 h | advertencia |
| `ObservabilidadDegradada` | Un Pod del stack no listo 5 min, o más de 2 reinicios en 15 min | n/a | n/a | advertencia |

Los ritmos 14.4 y 6 son los que propone el libro de SRE de Google para alertar con dos ventanas. La columna "Se agota en" dice lo que significan con mi ventana de 7 días.

Cada alerta lleva en sus anotaciones un `runbook_url` y un campo `intervencion` con la razón por la que amerita que alguien haga algo. Los runbooks están en [P10/runbooks](../runbooks/).

Apagué las alertas que trae kube-prometheus-stack (`defaultRules.create: false`). En GKE varias suenan para siempre, porque el plano de control no es visible, y ninguna estaba atada a algo que sienta el cliente. Si las dejaba, iba a aprender a ignorar esos correos, y con ellos los de mis SLO.

Las alertas me llegan por correo. Alertmanager usa Gmail con una contraseña de aplicación, y toda su configuración va sellada en el repo GitOps (`secretos/alertmanager-correo.yaml`). La versión legible, con marcadores en lugar de los datos, está en [P10/alertmanager/alertmanager.plantilla.yaml](../alertmanager/alertmanager.plantilla.yaml).

## Lo que estos SLO no ven

Conozco tres huecos:

- El SLO de latencia solo mira el catálogo. Una compra lenta cuenta para la disponibilidad solo si termina en 5xx. Lo dejé así porque el catálogo es el 90 % del tráfico, pero las órdenes quedan sin cubrir.
- GraphQL puede responder 200 con un campo `errors` adentro. El gateway lo pasa tal cual y el SLO lo cuenta como éxito.
- Si Prometheus se cae, no suena ninguna alerta, ni la de observabilidad. Me falta un vigilante externo.
