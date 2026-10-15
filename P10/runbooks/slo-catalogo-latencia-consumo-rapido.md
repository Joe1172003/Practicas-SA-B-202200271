# SloCatalogoLatenciaConsumoRapido

**Severidad:** crítica. Hay que atenderla ya.

## Qué significa

Más del 14.4 % de las consultas al catálogo están tardando más de 500 ms, en la última hora y en los últimos 5 minutos. El SLO permite que solo el 1 % sea lento; a este ritmo, ese margen de la semana se acaba en unas 12 horas.

## Qué siente el cliente

El catálogo es el 90 % de lo que hacen los clientes. Una de cada siete visitas espera más de medio segundo frente a una pantalla en blanco, y mucha gente cierra la pestaña antes.

## Primeros 3 minutos: de la alerta a la causa

1. **Quién está lento.** En el tablero **Operación SA P10**, panel *Latencia p95 por servicio*. Si el gateway y productos suben juntos, el problema está en productos o más abajo. Si solo sube el gateway, es el gateway.
2. **Una consulta lenta.** En **Explore → Tempo**:
   ```
   { resource.service.name = "gateway" && name = "POST /graphql/productos" && duration > 500ms }
   ```
   Abre una traza y busca el tramo que se come el tiempo. En este sistema ya pasó dos veces:
   - `pg-pool.connect` largo (~100 ms) en cada petición: conexiones a postgres que se reabren;
   - un Pod con la CPU estrangulada.
3. **Logs de esa petición.** En el tramo lento, pulsa **Logs for this span**.

## Cómo resolver

| Lo que encontraste | Qué hacer |
|---|---|
| Empezó con un despliegue | `kubectl argo rollouts undo gateway -n sa-p8`, o revertir el PR del servicio |
| CPU estrangulada | Panel *Saturación* del tablero. Subir el límite de CPU en `valores/<servicio>.yaml` o dejar que el HPA escale |
| `pg-pool.connect` o consultas lentas | `kubectl -n sa-p8 top pod postgres-0`. Revisar conexiones abiertas con `select count(*) from pg_stat_activity` |
| Todo el clúster está lento | `kubectl top nodes`. Puede ser un nodo perdido: runbook de la P9 |

## Cuándo está resuelta

Cuando la ventana de 5 minutos baja del 14.4 %, llega el correo `[RESOLVED]`.
