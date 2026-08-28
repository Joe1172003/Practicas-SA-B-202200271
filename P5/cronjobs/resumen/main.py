"""
Cronjob 2
Cada 10 minutos lee lo que dejo el cronjob 1, cuenta cuantas ejecuciones hubo
por hora y publica el resumen en la cola. Notificaciones lo consume y lo guarda,
igual que cualquier otro aviso.

Es el eslabon que encadena los dos cronjobs: uno escribe, el otro lee y publica.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import pika
import psycopg2

DATABASE_URL = os.environ["DATABASE_URL"]
RABBITMQ_URL = os.environ["RABBITMQ_URL"]
COLA = os.environ.get("COLA_NOTIFICACIONES", "notificaciones")
CARNE = os.environ["CARNE"]

GMT_MENOS_6 = timezone(timedelta(hours=-6))


def consultar_por_hora(conexion) -> list[dict]:
    with conexion.cursor() as cursor:
        cursor.execute(
            """
            SELECT date_trunc('hour', fecha_ejecucion AT TIME ZONE 'UTC-6') AS hora,
                   COUNT(*) AS ejecuciones
            FROM bitacora
            WHERE carne = %s
            GROUP BY hora
            ORDER BY hora
            """,
            (CARNE,),
        )
        return [
            {"hora": fila[0].isoformat(), "ejecuciones": int(fila[1])}
            for fila in cursor.fetchall()
        ]


def publicar(resumen: dict) -> None:
    # Deja el resumen en la misma cola durable que usan los microservicios.
    conexion = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    canal = conexion.channel()
    canal.queue_declare(queue=COLA, durable=True)

    canal.basic_publish(
        exchange="",
        routing_key=COLA,
        body=json.dumps(resumen, ensure_ascii=False).encode("utf-8"),
        # delivery_mode 2 marca el mensaje como persistente: sobrevive a un
        # reinicio del broker, igual que la cola durable.
        properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
    )
    conexion.close()


def main() -> None:
    try:
        conexion = psycopg2.connect(DATABASE_URL)
    except psycopg2.Error as error:
        print(f"[ERROR] Sin conexion a la base: {error}", flush=True)
        sys.exit(1)

    try:
        por_hora = consultar_por_hora(conexion)
    except psycopg2.Error as error:
        # La tabla no existe si el cronjob 1 todavia no corrio nunca.
        print(f"[ERROR] Fallo la consulta: {error}", flush=True)
        conexion.close()
        sys.exit(1)
    finally:
        conexion.close()

    if not por_hora:
        # Sin datos no hay nada que resumir. Salir con 0 para que Kubernetes
        # lo cuente como exito y no lo reintente.
        print("Sin registros en la bitacora todavia. Nada que publicar.", flush=True)
        return

    total = sum(h["ejecuciones"] for h in por_hora)

    resumen = {
        "tipo": "resumen_bitacora",
        "email": f"bitacora-{CARNE}@sa-p5.local",
        "datos": {
            "carne": CARNE,
            "generado": datetime.now(GMT_MENOS_6).isoformat(),
            "totalEjecuciones": total,
            "porHora": por_hora,
        },
    }

    try:
        publicar(resumen)
    except pika.exceptions.AMQPError as error:
        print(f"[ERROR] No se pudo publicar en la cola: {error}", flush=True)
        sys.exit(1)

    print( f"Resumen publicado: {total} ejecuciones en {len(por_hora)} hora(s).", flush=True)
    for h in por_hora:
        print(f"  {h['hora']} -> {h['ejecuciones']}", flush=True)


if __name__ == "__main__":
    main()
