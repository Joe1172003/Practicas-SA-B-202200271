# ObservabilidadDegradada

**Severidad:** advertencia. No afecta a los clientes ahora, pero deja ciego al que tenga que atender la próxima falla.

## Qué significa

Un Pod del namespace `observabilidad` lleva 5 minutos sin estar listo, o se reinició más de 2 veces en 15 minutos. Mientras dure, faltan métricas, trazas o logs, según cuál sea.

| Pod | Qué se pierde |
|---|---|
| `tempo-0` | Trazas. El recorrido alerta → traza → log se corta en el segundo paso |
| `loki-0` | Logs. No se puede leer el error |
| `otel-collector-agent-*` | Trazas, métricas y logs de los servicios de ese nodo |
| `prometheus-kps-prometheus-0` | Todo lo demás, incluida esta alerta. Ver "Límite conocido" |
| `grafana-*` | La vista. Los datos se siguen guardando |

## Por qué existe

El 15/10, Tempo estuvo unos 40 minutos en CrashLoopBackOff por falta de memoria (OOMKilled) y nadie se enteró: lo vi de casualidad revisando ArgoCD. Probé esta regla contra esa noche y habría avisado a las 03:30, 35 minutos antes.

## Primeros pasos

```bash
kubectl -n observabilidad get pods
kubectl -n observabilidad describe pod <pod>              # Events: OOMKilled, FailedScheduling...
kubectl -n observabilidad logs <pod> --previous --tail=50
```

## Causas conocidas

| Lo que dice `describe` | Qué hacer |
|---|---|
| `OOMKilled` | Subir `resources.limits.memory` en `apps/observabilidad/<app>.yaml` del repo GitOps |
| El StatefulSet ya tiene el límite nuevo pero el Pod sigue fallando | Un StatefulSet no reemplaza un Pod roto de la revisión anterior: `kubectl -n observabilidad delete pod <pod>` (los datos están en su PVC) |
| `FailedScheduling` | Falta CPU o memoria en los nodos: `kubectl describe nodes` |
| El disco está lleno | Bajar la retención o agrandar el PVC |

## Límite conocido

Si el que se cae es Prometheus, esta alerta no suena: la evalúa el mismo Prometheus. Para cubrir ese caso haría falta un vigilante externo, una alerta "siempre encendida" (Watchdog) que un servicio de afuera espera recibir. No está implementado.
