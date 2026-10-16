<p align="left">
Universidad San Carlos de Guatemala<br>
Facultad de Ingeniería<br>
Ingeniería en ciencias y sistemas<br>
Laboratorio de Software Avanzado

Nombre: Sergio Joel Rodas Valdez<br>
Carné: 202200271
</p>

# Práctica 10 - Observabilidad y operación

Instrumenté gateway, auth, ordenes y productos con OpenTelemetry y monté Prometheus, Loki, Tempo y Grafana por GitOps, sobre el clúster de la P9. Al canary del gateway le quité los Jobs de k6: ahora decide con métricas del tráfico real. Después rompí el sistema dos veces a propósito y medí cuánto tardé en enterarme y en llegar a la causa.

# Diagrama del flujo de telemetría

Recorrido de la señal desde cada servicio hasta el tablero y la alerta. Los números siguen una petición de punta a punta. El original está en [diagrama-telemetria.drawio](evidencias/assets/diagrama-telemetria.drawio).

![Diagrama del flujo de telemetría](./evidencias/assets/diagrama-telemetria.png)
___
# Tabla de enlaces

| Ítem | Enlace o dato |
|---|---|
| Repositorio de código | https://github.com/Joe1172003/Practicas-SA-B-202200271 |
| Repositorio GitOps | https://github.com/Joe1172003/sa-p8-gitops |
| Servicios instrumentados | `gateway`, `auth`, `ordenes` y `productos`, en el namespace `sa-p8`. Código: [telemetria.ts](../P4/backend-ts/gateway/src/telemetria.ts) y [registros.ts](../P4/backend-ts/gateway/src/registros.ts), iguales en los cuatro |
| AnalysisTemplate por métricas | `gateway-metricas`, en [analisis/gateway-metricas.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/analisis/gateway-metricas.yaml) del repo GitOps |
| Consultas del análisis | Las cuatro expresiones PromQL, con su condición, están abajo en [Consultas del canary](#consultas-del-canary) |
| SLO declarados | Disponibilidad: 99.5 % de las peticiones al gateway sin 5xx, ventana de 7 días. Catálogo: 99 % de las consultas en 500 ms o menos, ventana de 7 días. Justificación en [slo/definicion-slo.md](slo/definicion-slo.md) |
| Reglas de alerta | [slo/slo-disponibilidad.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/slo/slo-disponibilidad.yaml), [slo/slo-catalogo-latencia.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/slo/slo-catalogo-latencia.yaml) y [slo/observabilidad.yaml](https://github.com/Joe1172003/sa-p8-gitops/blob/main/slo/observabilidad.yaml), en el repo GitOps |
| Tablero | [P10/tableros/operacion-sa-p10.json](tableros/operacion-sa-p10.json) |
| Reversión por métricas | AnalysisRun `gateway-7f68876b45-7` (Failed) del Rollout `gateway`, namespace `sa-p8`: [evidencias/07-simulacro-1-canary.txt](evidencias/07-simulacro-1-canary.txt). Antes, la v2.4.1 también se revirtió por latencia: `gateway-7ccfb97b8f-4` |
| Recorrido síntoma a causa | [evidencias/08-simulacro-2-alerta-y-recorrido.txt](evidencias/08-simulacro-2-alerta-y-recorrido.txt). Tiempo medido: 1 min 6 s del correo al log de la causa |
| Video demostrativo | https://drive.google.com/file/d/1DNPoxyNe0j8JzEByw4YLTJoQmW33UYhl/view?usp=sharing |

## Qué hay en cada carpeta

| Carpeta o archivo | Contenido |
|---|---|
| [slo](slo/) | Los dos SLO y por qué elegí cada número |
| [runbooks](runbooks/) | Qué hacer cuando suena cada una de las cinco alertas |
| [tableros](tableros/) | El JSON del tablero, exportado de Grafana |
| [alertmanager](alertmanager/) | La configuración del correo con marcadores en lugar de los datos, y el script que la sella |
| [evidencias](evidencias/) | Salidas de comandos con hora y resultado, desde la fase 0 hasta los simulacros |
| [evidencias/assets](evidencias/assets/) | Las capturas y el diagrama |
| [informe-operacion.md](informe-operacion.md) | El informe de operación, en dos páginas |
| `P4/backend-ts` | La instrumentación: `telemetria.ts` y `registros.ts` en cada servicio, y las métricas de negocio en [metricas.ts](../P4/backend-ts/ordenes/src/ordenes/metricas.ts) |
| Repo GitOps | El stack en [apps/observabilidad](https://github.com/Joe1172003/sa-p8-gitops/tree/main/apps/observabilidad), el análisis del canary, las reglas, el tablero y el generador de tráfico |

## Lo que pide el enunciado y dónde está

| Pide | Lo que hice | Evidencia |
|---|---|---|
| OpenTelemetry en tres servicios, con propagación | Cuatro servicios. Una orden de punta a punta es una sola traza | [03](evidencias/03-instrumentacion-v2.4.0.txt), [captura 06](evidencias/assets/06-tempo-traza-4-servicios.png) |
| Métricas técnicas y de negocio | Latencia, errores y saturación, más `ordenes_total`, `ordenes_rechazadas_total` y `ventas_quetzales_total` | [03](evidencias/03-instrumentacion-v2.4.0.txt), [captura 10](evidencias/assets/10-metricas-negocio.png) |
| Registros JSON con el trace_id | pino escribe JSON con `trace_id` y el Collector lo vuelve un campo de Loki | [captura 11](evidencias/assets/11-loki-logs-por-trace-id.png) |
| Stack desplegado por GitOps | Prometheus, Loki, Tempo, el Collector, las reglas y el tablero son apps de ArgoCD | [01](evidencias/01-stack-observabilidad.txt), [captura 01](evidencias/assets/01-argocd-apps.png) |
| Canary gobernado por métricas | `gateway-metricas` consulta Prometheus; ya no corre ningún Job | [04](evidencias/04-canary-por-metricas.txt), [captura 14](evidencias/assets/14-canary-metricas-rollout.png) |
| Dos SLO con reglas de registro | El indicador y el presupuesto se calculan con reglas `slo:*` | [05](evidencias/05-slo-y-alertas.txt), [captura 16](evidencias/assets/16-prometheus-reglas-slo-catalogo.png) |
| Alertas por consumo del presupuesto, con runbook | Cuatro de burn rate (14.4× y 6×) y una del propio stack | [05](evidencias/05-slo-y-alertas.txt), [captura 17](evidencias/assets/17-prometheus-alertas-inactivas.png) |
| Tablero con las cuatro señales de oro | Una fila por pregunta: SLO, tráfico, errores, latencia y saturación | [06](evidencias/06-tablero-operacion.txt), [captura 20](evidencias/assets/20-tablero-slo-y-trafico.png) |
| Fallo inducido distinto al de la P8, revertido por el canary | v2.5.0 con timeout de 20 ms: revertida en 92 s, sin que yo tocara nada | [07](evidencias/07-simulacro-1-canary.txt), [captura 22](evidencias/assets/22-canary-2.5.0-analysisrun.png) |
| Recorrido alerta, traza y registro, cronometrado | 1 min 6 s del correo al log de la causa | [08](evidencias/08-simulacro-2-alerta-y-recorrido.txt), [captura 24c](evidencias/assets/24c-simulacro2-log-causa.png) |
| El flujo previo sigue funcionando | Cada versión pasó por el mismo pipeline: pruebas, Trivy, firma con Cosign y Kyverno. Trivy hasta frenó una CVE crítica nueva | [02](evidencias/02-trivy-bloqueo-proxy-addr.txt) |

## Consultas del canary

`gateway-metricas` mide la versión candidata cada 30 s mientras atiende tráfico real. Distingo candidata y estable por el hash de su ReplicaSet, que Argo Rollouts pasa como argumento y que Prometheus guarda en `k8s_pod_name`.

| Métrica | Pasa si | Cuándo revierte |
|---|---|---|
| `trafico-candidata` | 20 peticiones o más en 2 min | No revierte: si no llega, el canary se pausa |
| `tasa-de-error` | menos de 5 % de respuestas 5xx | con 2 lecturas malas seguidas |
| `latencia-p95-relativa` | p95 de la candidata ≤ 2 veces el de la estable | con 4 lecturas malas seguidas |
| `latencia-p95-maxima` | p95 de la candidata menor a 1 s | con 4 lecturas malas seguidas |

```promql
# trafico-candidata
sum(increase(http_server_request_duration_seconds_count{job="gateway", k8s_pod_name=~"gateway-{{args.hash-candidata}}-.*"}[2m])) or vector(0)

# tasa-de-error
(sum(rate(http_server_request_duration_seconds_count{job="gateway",
    k8s_pod_name=~"gateway-{{args.hash-candidata}}-.*",
    http_response_status_code=~"5.."}[2m])) or vector(0))
/
clamp_min(sum(rate(http_server_request_duration_seconds_count{job="gateway",
    k8s_pod_name=~"gateway-{{args.hash-candidata}}-.*"}[2m])) or vector(0), 0.0001)

# latencia-p95-relativa
(
  histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{job="gateway",
      k8s_pod_name=~"gateway-{{args.hash-candidata}}-.*"}[1m])))
  /
  histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{job="gateway",
      k8s_pod_name=~"gateway-{{args.hash-estable}}-.*"}[1m])))
) or vector(1)

# latencia-p95-maxima
histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{job="gateway",
    k8s_pod_name=~"gateway-{{args.hash-candidata}}-.*"}[1m])))
or vector(0)
```
___
# Evidencias

## El stack, por GitOps

Las apps del stack en ArgoCD, todas Synced y Healthy. Prometheus, Loki, Tempo y el Collector entraron por el repo GitOps, igual que los servicios: no instalé nada a mano.

![Apps en ArgoCD](./evidencias/assets/01-argocd-apps.png)

El árbol de kube-prometheus-stack: Prometheus, Alertmanager y Grafana salen del chart que declaré en Git.

![kube-prometheus-stack en ArgoCD](./evidencias/assets/02-argocd-kube-prometheus-stack.png)

Los 29 objetivos de Prometheus en up: el Collector, ingress-nginx, kubelet, node-exporter y el propio stack.

![Objetivos de Prometheus](./evidencias/assets/03-prometheus-targets.png)

Grafana con sus tres orígenes conectados: Prometheus, Loki y Tempo.

![Orígenes de datos de Grafana](./evidencias/assets/04-grafana-datasources.png)

Los primeros registros de `sa-p8` llegando a Loki. El Collector los lee del disco de cada nodo.

![Logs de sa-p8 en Loki](./evidencias/assets/05-loki-logs-sa-p8.png)

## Una petición, una traza

Creé y pagué una orden como cliente, y salió una sola traza que pasa por gateway, auth, ordenes y productos. No escribí propagación a mano: la autoinstrumentación agrega `traceparent` a cada llamada.

![Traza de cuatro servicios en Tempo](./evidencias/assets/06-tempo-traza-4-servicios.png)

Los logs de esa misma orden, de los cuatro servicios, con una sola consulta por `trace_id` en Loki.

![Logs por trace_id](./evidencias/assets/11-loki-logs-por-trace-id.png)

Después de mi compra de prueba, `ordenes_total` marca una orden creada y una pagada. También mido las ventas en quetzales y las órdenes rechazadas por causa.

![Métricas de negocio](./evidencias/assets/10-metricas-negocio.png)

## El canary, antes y después

Así decidía el canary de la P8: tres AnalysisTemplate que corrían Jobs de k6, una prueba sintética de 30 o 45 segundos.

![Plantillas de k6](./evidencias/assets/12-canary-antes-jobs-k6.png)

![Provider job](./evidencias/assets/12b-canary-antes-provider-job.png)

La v2.4.0 sana falló dos veces en ese canary y pasó a la tercera, con la misma imagen. Ese falso negativo es la razón del cambio.

![Falso negativo del canary con k6](./evidencias/assets/13-canary-antes-falso-negativo.png)

El Rollout nuevo: 20 % y 50 %, 3 minutos cada uno, con el análisis por métricas corriendo de fondo. Aquí está pasando la v2.4.2.

![Rollout con análisis por métricas](./evidencias/assets/14-canary-metricas-rollout.png)

El tráfico real repartido entre la estable (2.4.0) y la candidata (2.4.2) mientras avanza el canary. Eso es lo que mide el análisis.

![Tráfico por versión](./evidencias/assets/15-canary-trafico-por-version.png)

## SLO y alertas

Las reglas de registro de los dos SLO, todas sanas: indicador, presupuesto y alertas.

![Reglas del SLO del catálogo](./evidencias/assets/16-prometheus-reglas-slo-catalogo.png)

![Reglas del SLO de disponibilidad](./evidencias/assets/16b-prometheus-reglas-slo-disponibilidad.png)

Las cinco alertas cargadas y en inactive, cada una con su runbook.

![Alertas inactivas](./evidencias/assets/17-prometheus-alertas-inactivas.png)

El presupuesto del catálogo ese día: 8 % gastado, casi todo por los Pods recién arrancados de los canary. La disponibilidad de 7 días estaba en 100 % antes de los simulacros.

![Presupuesto del catálogo consumido](./evidencias/assets/18-presupuesto-catalogo-consumido.png)

![SLI de disponibilidad de 7 días](./evidencias/assets/18b-sli-disponibilidad-7d.png)

La primera prueba del camino hasta mi correo: una alerta de prueba con amtool, con su [FIRING] y su [RESOLVED]. Tapé mi correo y mi foto.

![Correo FIRING de prueba](./evidencias/assets/19-correo-alerta-firing.png)

![Correo RESOLVED de prueba](./evidencias/assets/19b-correo-alerta-resolved.png)

## El tablero

El tablero Operación SA P10 en operación. Arriba el SLO y el presupuesto; abajo tráfico, errores, latencia y saturación, una pregunta por fila.

![Tablero: SLO y tráfico](./evidencias/assets/20-tablero-slo-y-trafico.png)

![Tablero: errores y latencia](./evidencias/assets/20b-tablero-errores-y-latencia.png)

![Tablero: latencia y saturación](./evidencias/assets/20c-tablero-latencia-y-saturacion.png)

La primera alerta real: ObservabilidadDegradada me avisó cuando Grafana se quedó sin memoria (20:44 UTC). Le subí la memoria y llegó el RESOLVED.

![Alerta real FIRING](./evidencias/assets/21-correo-alerta-real-firing.png)

![Alerta real RESOLVED](./evidencias/assets/21b-correo-alerta-real-resolved.png)

## Simulacro 1: el canary revierte la v2.5.0

El AnalysisRun `gateway-7f68876b45-7`: tasa de error de 0.62 y 0.53, dos fallas, y el Rollout abortó solo a los 92 s del primer tráfico.

![AnalysisRun de la v2.5.0](./evidencias/assets/22-canary-2.5.0-analysisrun.png)

La historia del Rollout: de los Jobs de k6 al análisis por métricas, y la 2.5.0 rechazada.

![Historia de revisiones del Rollout](./evidencias/assets/22b-canary-historia-de-revisiones.png)

En el tablero, el pico de 503 durante el canary y la vuelta a 200 sin que yo hiciera nada.

![Pico de errores del canary](./evidencias/assets/22c-tablero-pico-errores-canary.png)

Ensayando el recorrido encontré otro problema: un 503 por ECONNRESET cada vez que productos se redespliega. Aquí están su traza y su log.

![Traza del ECONNRESET](./evidencias/assets/23-ensayo-traza-econnreset.png)

![Log del ECONNRESET](./evidencias/assets/23b-ensayo-log-econnreset.png)

## Simulacro 2: de la alerta a la causa

Me llega el correo [FIRING] de SloDisponibilidadConsumoRapido a las 23:55:22 UTC, con el enlace al runbook.

![Correo FIRING del simulacro 2](./evidencias/assets/25-correo-simulacro2-firing.png)

En el tablero, el tráfico de productos en 0 y el presupuesto de disponibilidad gastándose.

![Tablero durante la caída](./evidencias/assets/24-simulacro2-tablero-caida.png)

De la traza paso a Loki con el mismo trace_id y aparece la causa: "No se pudo contactar a http://productos:3002/graphql". Del correo a este log tardé 1 min 6 s.

![De la traza a Loki](./evidencias/assets/24b-simulacro2-loki-causa.png)

![El log de la causa](./evidencias/assets/24c-simulacro2-log-causa.png)

El [RESOLVED] después de revertir el PR, a las 00:05:28 UTC.

![Correo RESOLVED del simulacro 2](./evidencias/assets/25b-correo-simulacro2-resolved.png)

## Las evidencias en texto

| Archivo | Qué muestra |
|---|---|
| [00-capacidad.txt](evidencias/00-capacidad.txt) | Antes de instalar nada, medí si el stack cabía en los 3 nodos |
| [01-stack-observabilidad.txt](evidencias/01-stack-observabilidad.txt) | El stack por GitOps, los 29 objetivos y lo que falló al arrancar |
| [02-trivy-bloqueo-proxy-addr.txt](evidencias/02-trivy-bloqueo-proxy-addr.txt) | Trivy frenó una CVE crítica nueva: la cadena de suministro sigue funcionando |
| [03-instrumentacion-v2.4.0.txt](evidencias/03-instrumentacion-v2.4.0.txt) | La v2.4.0 instrumentada, la traza de cuatro servicios y los logs por trace_id |
| [04-canary-por-metricas.txt](evidencias/04-canary-por-metricas.txt) | El canary nuevo: la v2.4.1 revertida por latencia y la v2.4.2 aprobada |
| [05-slo-y-alertas.txt](evidencias/05-slo-y-alertas.txt) | Las reglas calculando, las cinco alertas y el correo de prueba |
| [06-tablero-operacion.txt](evidencias/06-tablero-operacion.txt) | El tablero y el primer incidente real: Grafana sin memoria |
| [07-simulacro-1-canary.txt](evidencias/07-simulacro-1-canary.txt) | El simulacro 1, minuto a minuto |
| [08-simulacro-2-alerta-y-recorrido.txt](evidencias/08-simulacro-2-alerta-y-recorrido.txt) | El simulacro 2 y el recorrido cronometrado |
___
# Runbooks

Uno por alerta. Su enlace va en la anotación `runbook_url` de cada regla, así que llega dentro del correo.

| Alerta | Runbook |
|---|---|
| SloDisponibilidadConsumoRapido | [slo-disponibilidad-consumo-rapido.md](runbooks/slo-disponibilidad-consumo-rapido.md) |
| SloDisponibilidadConsumoLento | [slo-disponibilidad-consumo-lento.md](runbooks/slo-disponibilidad-consumo-lento.md) |
| SloCatalogoLatenciaConsumoRapido | [slo-catalogo-latencia-consumo-rapido.md](runbooks/slo-catalogo-latencia-consumo-rapido.md) |
| SloCatalogoLatenciaConsumoLento | [slo-catalogo-latencia-consumo-lento.md](runbooks/slo-catalogo-latencia-consumo-lento.md) |
| ObservabilidadDegradada | [observabilidad-degradada.md](runbooks/observabilidad-degradada.md) |

# Informe de operación

Los seis campos de la plantilla, con las horas medidas en los dos simulacros: [informe-operacion.md](informe-operacion.md).

# Video

https://drive.google.com/file/d/1DNPoxyNe0j8JzEByw4YLTJoQmW33UYhl/view?usp=sharing
