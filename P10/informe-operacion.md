# Informe de operación

Hice dos simulacros el 15/10/2026. Las horas están en UTC y salen de los registros de Argo Rollouts, Prometheus, Alertmanager, Tempo y Loki (evidencias [07](evidencias/07-simulacro-1-canary.txt) y [08](evidencias/08-simulacro-2-alerta-y-recorrido.txt)).

## 1. SLO declarados

| SLO | Indicador | Objetivo | Ventana |
|---|---|---|---|
| Disponibilidad | peticiones al gateway sin 5xx | 99.5 % | 7 días |
| Latencia del catálogo | consultas al catálogo en 500 ms o menos | 99 % | 7 días |

El 99.5 % sale de lo que mi sistema aguantó en la P9. Con 99.9 % tendría 10 minutos de caída por semana, y una sola reconstrucción del clúster (27 min) rompe la promesa; con 99 % podría tener la tienda caída una tarde y seguir cumpliendo. 500 ms es donde una página deja de sentirse inmediata y es un límite del histograma (`le="0.5"`), así que la cuenta es exacta. Dejo 1 % de margen para las consultas lentas de cada despliegue; al definirlo ya cumplía 99.6 %. La ventana es semanal porque esa es mi pregunta ("¿cumplí esta semana?") y Prometheus guarda 8 días. Detalle en [definicion-slo.md](slo/definicion-slo.md).

## 2. Fallo inducido

Los dos son de errores; el de la P8 fue de latencia.

Simulacro 1, contra el canary: la v2.5.0 cambia el timeout de axios del gateway de `20000` a `20`, el error de creer que va en segundos. Con 20 ms, parte del catálogo y todas las compras terminan en 503. Pasó las 12 pruebas unitarias y el pipeline completo sin quejas.

Simulacro 2, contra la alerta: un PR en GitOps (#32) pasa productos al puerto 3005. El chart mueve juntos Service, contenedor y sondas, así que los Pods quedan sanos, pero gateway y ordenes siguen llamando a `productos:3002`. Productos no tiene canary y el cambio entra directo.

## 3. Tiempo de detección

| | Empieza el fallo | Primera señal | Tiempo |
|---|---|---|---|
| Simulacro 1 | 22:51:51, la v2.5.0 recibe el 20 % | 22:52:47, el AnalysisRun lee 61.8 % de errores | 56 s |
| Simulacro 2 | 23:41:00, el Service pasa a 3005 | 23:54:56 firing; 23:55:22 el correo | 13 min 56 s; 14 min 22 s |

En el simulacro 2 la métrica mostraba el fallo desde las 23:43:42 (23.4 % de errores en 5 min); la alerta tardó 11 minutos más (punto 6).

## 4. Recorrido hasta la causa

Simulacro 2. Las horas salen de los registros de Tempo y Loki, que anotan cada búsqueda que hago desde Grafana.

1. 23:55:22. Llega el correo de `SloDisponibilidadConsumoRapido`, con el enlace al runbook.
2. 23:56:16. En el tablero, "Errores por servicio" muestra que solo falla el gateway y el tráfico de productos está en 0. Hago clic en la línea del gateway y entro a Tempo con sus trazas con error.
3. 23:56:18. En la traza `88a64eec`, el tramo del gateway hacia productos está en rojo: `timeout of 20000ms exceeded`.
4. 23:56:28. Con "Logs for this span" paso a Loki con el mismo `trace_id`: `No se pudo contactar a http://productos:3002/graphql`.
5. Con esa URL sospecho del puerto, y `kubectl -n sa-p8 get svc productos` muestra 3005.

Del correo al log de la causa tardé 1 min 6 s (1 min 32 s desde el firing); el objetivo era 3 minutos. No revisé logs servicio por servicio: en la traza vi qué salto fallaba y en el log leí la URL.

## 5. Tiempo de recuperación

Simulacro 1: lo resolvió Argo Rollouts sin que yo tocara nada. A las 22:53:23 el AnalysisRun `gateway-7f68876b45-7` falló por `tasa-de-error` (0.618 y 0.534) y el Rollout devolvió el tráfico a la 2.4.3, 92 s después del primer tráfico. El 80 % de los clientes no vio la versión rota y el fallo gastó 1.94 % del presupuesto. Después revertí el PR (#31) para alinear GitOps.

Simulacro 2: lo resolví yo con un revert del PR #32 (merge 23:58:56). El catálogo volvió a responder 200 a las 23:59:48, 4 min 26 s después del correo; los clientes tuvieron 18 min 48 s de caída. Gastó el 101 % del presupuesto de disponibilidad, un número que engaña: la ventana solo tenía 23 h de datos. Con una semana completa (~2 millones de peticiones) habría sido ~12 %.

## 6. Alerta faltante o sobrante

Faltante: una alerta de síntoma. La de consumo rápido está hecha para degradaciones (más de 7.2 % de errores sostenido en 1 h) y ante una caída total tardó 14 minutos. No lo esperaba: con el timeout de 20 s cada consulta quedaba colgada antes del 503, los usuarios simulados esperaban y el gateway bajó de 3.3 a 1 petición por segundo. Con menos peticiones hubo menos errores por minuto, y la ventana de 1 h, llena de tráfico sano, tardó más en pasar el umbral. Una alerta con errores del gateway arriba de 50 % durante 2 min habría sonado cerca de las 23:44, 11 minutos antes.

Sobrante: ninguna. Fuera de los simulacros solo sonó `ObservabilidadDegradada` (15/10, 20:44), cuando Grafana se quedó sin memoria, y era real. En el simulacro 1 no sonó ninguna, y estuvo bien: el canary ya lo había contenido. El ruido lo quité antes, al apagar las alertas del chart, que en GKE suenan para siempre.

Mejoras a mi instrumentación:

- El gateway ya mide cada llamada con su destino y su error (`http_client_request_duration_seconds`): a las 23:50 marcaba 325 fallas hacia `productos:3002` y ningún éxito, contra 929 éxitos a las 23:35. Un panel "errores del gateway por destino", con su alerta, me habría mostrado la causa sin pasar por Tempo. Hay que excluir `otel-collector:4318`, que aparece porque el SDK se mide al exportar.
- Esa métrica dice `AxiosError` para todo: un timeout y un `ECONNRESET` se ven igual. Voy a guardar el código de axios en el tramo y en la métrica.
- Bajar el timeout del gateway de 20 s a 3 s: el cliente deja de esperar y las métricas ven la caída completa.
- Reintentar solo las consultas (repetir una compra duplicaría la orden) y poner un `preStop` en productos. En los ensayos vi 503 por `ECONNRESET` en cada redespliegue.
