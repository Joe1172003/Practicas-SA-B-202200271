# SloDisponibilidadConsumoLento

**Severidad:** advertencia. Hay que revisarla hoy, en horario de trabajo. No hace falta despertar a nadie.

## Qué significa

Más del 3 % de las peticiones fallan desde hace horas: lo confirman la ventana de 6 horas y la de 30 minutos. No es una caída, es una degradación sostenida. A este ritmo el presupuesto de la semana se acaba en poco más de un día.

## Qué siente el cliente

De vez en cuando, más o menos 1 de cada 30 veces, una página falla. Si recarga, casi siempre funciona. Por eso nadie llama, pero la confianza se gasta.

## Primeros pasos

1. **Dónde y desde cuándo.** En el tablero **Operación SA P10**, panel *Errores por servicio*, con un rango de 12 horas. Busca el momento en que empezó.
2. **Qué tienen en común los errores.** En **Explore → Loki**:
   ```
   {k8s_namespace_name="sa-p8"} | json | level="error"
   ```
   Agrupa mentalmente por mensaje. Si casi todos dicen lo mismo, esa es la causa.
3. **Una traza de ejemplo.** Desde una de esas líneas, el enlace **trace_id** abre la traza en Tempo.

## Causas típicas en este sistema

| Síntoma | Causa probable | Acción |
|---|---|---|
| Errores repartidos, sin despliegue reciente | Un Pod con poca memoria que se reinicia de vez en cuando | `kubectl -n sa-p8 get pods`: mirar `RESTARTS` y subir el límite en `valores/` del repo GitOps |
| Errores solo en órdenes | Productos responde lento y órdenes corta por timeout | Revisar el panel de latencia de productos y sus conexiones a postgres |
| Empezó con un despliegue que pasó el canary | La versión falla solo en un caso que el canary no vio | Revertir esa versión y abrir un issue con la traza |

## Cuándo está resuelta

Cuando las dos ventanas bajan del 3 %. Como la de 6 horas tarda en olvidar, la alerta puede seguir encendida un rato después del arreglo. Si la ventana de 30 minutos ya está limpia, el arreglo funcionó.
