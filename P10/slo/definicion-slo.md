# Definición de los SLO

Son dos promesas, escritas desde lo que vive el cliente y no desde la infraestructura. Ninguna habla de CPU ni de pods: hablan de si la tienda responde y de si responde rápido.

| | SLO 1: disponibilidad | SLO 2: latencia del catálogo |
|---|---|---|
| Promesa | La tienda responde sin fallar | El catálogo carga rápido |
| Indicador | Peticiones al gateway sin 5xx / peticiones al gateway | Consultas a `/graphql/productos` en 500 ms o menos / consultas a `/graphql/productos` |
| Objetivo | **99.5 %** | **99 %** |
| Ventana | **7 días móviles** | **7 días móviles** |
| Presupuesto de error | 0.5 % de las peticiones | 1 % de las consultas |
| Con el tráfico actual (~3 peticiones/s) | ~9 000 errores por semana | ~16 000 consultas lentas por semana |
| Reglas | [slo-disponibilidad.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/slo/slo-disponibilidad.yaml) | [slo-catalogo-latencia.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/slo/slo-catalogo-latencia.yaml) |

Los dos se miden en el gateway porque es la única puerta de los clientes: lo que ve el gateway es lo que vive el usuario. Las peticiones a `/health` no cuentan (son las sondas de Kubernetes, no clientes) y los 4xx tampoco (son errores del que llama, como una sesión vencida).

## Por qué 99.5 % y no otro número

Elegí el número mirando lo que mi sistema ya demostró que aguanta, no el que sonaba bien.

- **No 99.9 %.** Serían unos 10 minutos de caída por semana. En la P9 medí que perder el nodo de postgres deja el catálogo caído 71 segundos, y que reconstruir el clúster entero toma 27 minutos. Postgres es un punto único de fallo que todavía no resolví. Con un solo incidente de esos se rompe la promesa: prometer 99.9 % sería mentir.
- **No 99 %.** Sería 1 hora y 40 minutos de caída por semana sin romper nada. Para una tienda es demasiado: con ese margen podría dejarla caída una tarde entera y seguir "cumpliendo".
- **99.5 %** son unos 50 minutos por semana. Alcanza para un incidente serio de postgres o para una reconstrucción, pero no para dos. Me obliga a tomarme en serio la segunda falla de la semana.

## Por qué 500 ms y 99 %

- **500 ms** es más o menos donde una página deja de sentirse inmediata. Además coincide con un límite del histograma de OpenTelemetry (`le="0.5"`): la cuenta es exacta, no una estimación entre dos buckets.
- **99 % y no 99.5 %** porque la latencia tiene cola larga aunque nada esté roto. Cuando se reinicia un Pod, Node compila en caliente y el pool de conexiones a postgres arranca vacío: las primeras consultas tardan más. Lo vi en el canary de la v2.4.1, con un pico de 30 segundos de casi 2 s en un Pod recién creado. Ese ruido de cada despliegue tiene que caber en el presupuesto.
- Lo medido: en los 30 minutos previos a escribir esto, el 99.6 % de las consultas al catálogo respondieron en menos de 500 ms. El objetivo queda por debajo de lo que hoy logro, con margen para los despliegues.

## Por qué 7 días

- La práctica entrega cada semana: una ventana semanal responde la pregunta que importa, "¿cumplí lo que prometí esta semana?".
- Una ventana de 30 días, la más común en la industria, no cabe en mi Prometheus. La retención era de 3 días; la subí a 8 para que entre la semana completa. Medí el disco antes: ~190 MB cada 6 horas, unos 5 GB por semana en un volumen de 10 GiB.

## Las alertas

No alerto por umbral instantáneo ("hay un error"), sino por **ritmo de consumo del presupuesto** (*burn rate*). Ritmo 1 significa gastar el presupuesto justo en los 7 días. Cada alerta exige dos ventanas a la vez: la larga confirma que no es un pico, y la corta, que todavía está pasando.

| Alerta | Ritmo | Ventanas | Se agota en | Severidad |
|---|---|---|---|---|
| `SloDisponibilidadConsumoRapido` | 14.4× (más de 7.2 % de errores) | 1 h y 5 min | ~12 h | crítica |
| `SloDisponibilidadConsumoLento` | 6× (más de 3 % de errores) | 6 h y 30 min | ~28 h | advertencia |
| `SloCatalogoLatenciaConsumoRapido` | 14.4× (más de 14.4 % lentas) | 1 h y 5 min | ~12 h | crítica |
| `SloCatalogoLatenciaConsumoLento` | 6× (más de 6 % lentas) | 6 h y 30 min | ~28 h | advertencia |
| `ObservabilidadDegradada` | Un Pod del stack no listo 5 min, o más de 2 reinicios en 15 min | n/a | n/a | advertencia |

Cada alerta trae en sus anotaciones un `runbook_url` y un campo `intervencion` con la razón por la que amerita que alguien haga algo. Los runbooks están en [P10/runbooks](../runbooks/).

Las alertas que vienen por defecto con kube-prometheus-stack están apagadas (`defaultRules.create: false`). En GKE varias suenan para siempre, porque el plano de control no es visible, y ninguna estaba atada a algo que el cliente sienta. Una alerta que nadie atiende es peor que ninguna.

Las alertas llegan por correo: Alertmanager usa Gmail con una contraseña de aplicación, y toda su configuración va sellada en el repo GitOps (`secretos/alertmanager-correo.yaml`). La versión legible, con marcadores en lugar de los datos, está en [P10/alertmanager/alertmanager.plantilla.yaml](../alertmanager/alertmanager.plantilla.yaml).

## Lo que estos SLO no ven

- **Las órdenes.** El SLO de latencia solo mira el catálogo. Una compra lenta cuenta para la disponibilidad solo si termina en 5xx. Lo elegí así porque el catálogo es el 90 % del tráfico, pero es un hueco.
- **Errores dentro de un 200.** GraphQL puede responder 200 con un campo `errors` adentro. El gateway lo pasa tal cual y el SLO lo cuenta como éxito.
- **Si Prometheus se cae,** ninguna alerta suena, incluida la de observabilidad. Falta un vigilante externo.
