# SloDisponibilidadConsumoRapido

**Severidad:** crítica. Hay que atenderla ya, aunque sea de madrugada.

## Qué significa

Más del 7.2 % de las peticiones de los clientes están respondiendo con error 5xx. Lo dicen dos ventanas a la vez: la última hora, así que no es un pico, y los últimos 5 minutos, así que sigue pasando. A este ritmo el presupuesto de error de la semana, el 0.5 % de las peticiones, se acaba en unas 12 horas.

## Qué siente el cliente

Abre el catálogo o intenta comprar y le sale un error. Con unas 3 peticiones por segundo, cada minuto son más de diez personas.

## Primeros 3 minutos: de la alerta a la causa

1. **Qué servicio falla.** En Grafana, abre el tablero **Operación SA P10** y mira el panel *Errores por servicio*. El que tiene la barra roja es el origen. Si solo aparece el gateway, el problema está en lo que el gateway llama.
2. **Una petición que falló.** En **Explore → Tempo**, con TraceQL:
   ```
   { resource.service.name = "gateway" && status = error }
   ```
   Abre la traza más reciente. El tramo rojo más profundo es donde se originó el error.
3. **El log del error.** En ese tramo, pulsa **Logs for this span**. Se abre Loki filtrado por el `trace_id`, con la línea `"level":"error"` y el mensaje.

## Cómo resolver

| Lo que encontraste | Qué hacer |
|---|---|
| Empezó justo después de un despliegue | Revertir: `kubectl argo rollouts undo gateway -n sa-p8`. Si fue otro servicio, revertir su PR en el repo GitOps |
| El error dice que no conecta a postgres | `kubectl -n sa-p8 get pod postgres-0`. Si no está `Running`, seguir el runbook de pérdida de nodo de la P9 |
| Un servicio se reinicia en bucle | `kubectl -n sa-p8 get pods` y `kubectl -n sa-p8 logs <pod> --previous` |
| No hay un patrón claro | Escalar con el `trace_id` y la hora de inicio de la alerta |

## Cuándo está resuelta

Cuando la tasa de los últimos 5 minutos baja del 7.2 %, la alerta se apaga sola y llega un correo `[RESOLVED]`. Después hay que anotar cuánto presupuesto se gastó: el panel *Presupuesto de error* del tablero.
