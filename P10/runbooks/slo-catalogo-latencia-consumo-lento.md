# SloCatalogoLatenciaConsumoLento

**Severidad:** advertencia. Hay que revisarla hoy, en horario de trabajo.

## Qué significa

Más del 6 % de las consultas al catálogo tardan más de 500 ms desde hace horas, en la ventana de 6 horas y en la de 30 minutos. El margen de la semana, un 1 % de consultas lentas, se acaba en poco más de un día.

## Qué siente el cliente

El catálogo se siente "pesado" a ratos, sin llegar a fallar.

## Primeros pasos

1. **Desde cuándo.** En el tablero **Operación SA P10**, panel *Latencia p95 por servicio*, con un rango de 12 a 24 horas. ¿Coincide con un despliegue, con más tráfico (panel *Tráfico*) o con algo de saturación (panel *Saturación*)?
2. **Dónde se va el tiempo.** Abre varias trazas lentas en Tempo, como en el runbook de consumo rápido, y compara: si el tramo lento es siempre el mismo, esa es la causa.

## Causas típicas en este sistema

| Síntoma | Causa probable | Acción |
|---|---|---|
| Sube junto con el tráfico | Faltan réplicas o CPU | Revisar el HPA (`kubectl -n sa-p8 get hpa`) y los límites |
| Empezó tras un despliegue que pasó el canary | Una regresión pequeña, por debajo del umbral del canary (2× la estable) | Comparar el p95 por `service_version` en Prometheus y revertir si la nueva es peor |
| Picos aislados de ~1 s | Pods arrancando: JIT de Node, pool de conexiones vacío | Si solo pasa en despliegues, es esperable; si no, revisar reinicios |

## Cuándo está resuelta

Cuando la ventana de 30 minutos baja del 6 %. La de 6 horas tarda en olvidar, así que la alerta puede durar un poco más que el problema.
