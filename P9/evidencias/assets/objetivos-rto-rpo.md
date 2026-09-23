# Mis objetivos de recuperación (RTO y RPO)

## Qué prometo

| Objetivo | Valor | Qué significa |
|---|---|---|
| RTO | 45 minutos | Desde que el clúster deja de existir hasta que la plataforma vuelve a responder por su URL, con los datos puestos |
| RPO | 3 horas | Lo máximo que puedo perder de lo que se escribió antes del desastre |

## De dónde salen esos números

### El RTO

No lo inventé. Ya medí cada pedazo en las fases anteriores que estuve trabajando:

| Paso | Lo que tardó cuando lo hice |
|---|---|
| Terraform crea el clúster, los nodos y ArgoCD | 10 min 47 s |
| ArgoCD levanta las herramientas y las 9 apps | cerca de 10 min |
| Restaurar los datos desde el respaldo | 57 s |
| Revisar que todo responda | unos 5 min |

Suma unos 27 minutos. Le dejo margen hasta 45 porque el día del simulacro algo se va a
portar distinto: GKE puede tardar más en dar los nodos, una imagen puede bajar lenta, o
me voy a trabar leyendo un error. Prometer 30 minutos sería querer quedar bien; prometer dos horas sería no prometer nada por eso prometer 45 es para mi algo que si se podríaa prometer.

### El RPO

Sale directo del calendario de Velero: respaldo cada 3 horas. Si el desastre ocurre justo antes del siguiente respaldo, pierdo esas 3 horas de escrituras. En promedio voy a perder **hora y media**.

Elegí 3 horas y no 1 porque este sistema recibe pocas escrituras por día (usuarios que se registran y órdenes de prueba), no mueve dinero real y nadie depende de él para trabajar.

Respaldar cada hora me daría un número más lindo para mostrar, pero no puedo justificarlo con lo que hace el sistema.

## Qué cuenta y qué no

El reloj del RTO arranca cuando el clúster deja de existir y se detiene cuando:

- las 15 apps de ArgoCD están Synced y Healthy,
- el gateway responde 200 en `/health` por el Ingress,
- el catálogo devuelve los productos restaurados.

Dentro del alcance está todo lo que vive en el clúster: nodos, herramientas,
microservicios, políticas y los datos de postgres.

Fuera del alcance quedan tres cosas que no puedo reconstruir yo, y me parece más honesto decirlo ahora que descubrirlo en el simulacro:

- GitHub. Si el repositorio no está disponible, ArgoCD no tiene de dónde leer y la
  reconstrucción no arranca.
- GHCR. Si el registro se cae, las imágenes no bajan.

También quedan fuera el bucket de respaldos, la IP pública y la llave de Sealed Secrets,
porque viven en la capa permanente y el simulacro no las toca. Esa es justamente la idea:
son lo que tiene que sobrevivir.

## Lo que espero que salga mal

Prefiero anotarlo antes para no acomodar la historia después.

1. Los primeros minutos van a ser de espera pura mirando cómo GKE crea nodos. No hay nada que hacer ahí y no cuenta como problema.
2. Sospecho que Kyverno va a rechazar algún Pod mientras arranca, hasta que su webhook esté listo. 
3. La restauración de datos depende de que el snapshot esté READY en GCP. 
4. El catálogo va a tardar un poco más que el resto, porque postgres tiene que enganchar su disco antes de aceptar conexiones.

## Cómo lo voy a medir

Con `date -u` en cada paso del script de reconstrucción, no a ojo. El registro completo queda en las evidencias del simulacro, con la hora de la destrucción, la de cada etapa y la del último chequeo.

Para el RPO voy a escribir datos a propósito después del último respaldo y contar cuáles sobreviven. Ese número, y no otro, es el RPO real.

## Si no llego

Si el simulacro se pasa de 45 minutos, lo escribo tal cual en el informe con el motivo.
Ajustar el objetivo para que coincida con lo medido sería trampa, y además me dejaría sin la parte útil del ejercicio, que es saber dónde perdí el tiempo.
