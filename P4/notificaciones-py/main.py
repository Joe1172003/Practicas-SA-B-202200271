"""
Microservicio de NOTIFICACIONES.

CAMBIO GRANDE DE LA P5: antes era un servidor web que esperaba que le
llamaran. Ahora es un consumidor: se conecta a RabbitMQ y saca mensajes de
una cola cuando puede.

La diferencia practica es la que pide el enunciado: si este proceso esta
apagado, Auth y Ordenes siguen funcionando igual y sus avisos quedan
esperando en la cola. Al encenderlo, los procesa todos sin perder ninguno.

Sigue sin mandar correos reales: imprime, escribe en el log y guarda en la
base de datos.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pika
import psycopg2
from psycopg2.extras import Json

# --- Configuracion, toda por variables de entorno ---
RABBITMQ_URL = os.environ["RABBITMQ_URL"]
COLA = os.environ.get("COLA_NOTIFICACIONES", "notificaciones")
DATABASE_URL = os.environ["DATABASE_URL"]
ARCHIVO_LOG = Path(os.environ.get("ARCHIVO_LOG", "/app/logs/notificaciones.log"))

# Archivo que este proceso "toca" en cada vuelta para avisar que sigue vivo.
# Es lo que revisa el healthcheck, porque ya no hay endpoint que consultar.
ARCHIVO_LATIDO = Path(os.environ.get("ARCHIVO_LATIDO", "/tmp/latido"))

# Cada cuanto se refresca el latido aunque no llegue ningun mensaje. Tiene que
# ser bastante menor que LATIDO_TOLERANCIA de latido.py, que son 300s.
SEGUNDOS_ENTRE_LATIDOS = int(os.environ.get("LATIDO_INTERVALO", "30"))

TIPOS_VALIDOS = ("usuario_registrado", "orden_pagada", "orden_cancelada")


def crear_tabla(conexion) -> None:
    """La tabla se crea sola al arrancar, como hace TypeORM en los otros."""
    with conexion.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS notificaciones (
                id       SERIAL PRIMARY KEY,
                fecha    TIMESTAMPTZ  NOT NULL,
                tipo     VARCHAR(40)  NOT NULL,
                email    VARCHAR(160) NOT NULL,
                mensaje  TEXT         NOT NULL,
                datos    JSONB
            )
            """
        )
    conexion.commit()


def armar_mensaje(tipo: str, datos: dict[str, Any]) -> str:
    """Convierte la notificacion en el texto que veria el usuario."""

    if tipo == "usuario_registrado":
        nombre = datos.get("nombre", "usuario")
        return f"¡Bienvenido a la tienda, {nombre}! Tu cuenta quedo creada exitosamente."

    if tipo == "orden_pagada":
        orden = datos.get("ordenId", "?")
        total = datos.get("total", 0)
        return (
            f"Tu pago se confirmo. Orden {orden} por Q{total}. "
            f"Ya estamos preparando tu pedido."
        )

    orden = datos.get("ordenId", "?")
    motivo = datos.get("motivo", "sin motivo")
    return f"Tu orden {orden} fue cancelada. Motivo: {motivo}"


def escribir_en_log(linea: str) -> None:
    try:
        ARCHIVO_LOG.parent.mkdir(parents=True, exist_ok=True)
        with ARCHIVO_LOG.open("a", encoding="utf-8") as archivo:
            archivo.write(linea + "\n")
    except OSError as error:
        print(f"[AVISO] No se pudo escribir en {ARCHIVO_LOG}: {error}", flush=True)


def tocar_latido() -> None:
    """Actualiza la fecha del archivo de latido. Lo lee el healthcheck."""
    try:
        ARCHIVO_LATIDO.parent.mkdir(parents=True, exist_ok=True)
        ARCHIVO_LATIDO.touch()
    except OSError:
        # Que falle el latido no debe tumbar el consumo de mensajes.
        pass


def procesar(conexion, cuerpo: bytes) -> None:
    """
    Trabaja un mensaje. Si algo aqui truena, el mensaje NO se confirma y
    RabbitMQ lo devuelve a la cola para volver a intentarlo.
    """
    notificacion = json.loads(cuerpo)

    tipo = notificacion.get("tipo")
    email = notificacion.get("email", "desconocido")
    datos = notificacion.get("datos", {})

    if tipo not in TIPOS_VALIDOS:
        # Un tipo que no conocemos nunca va a poder procesarse, por mas veces
        # que se reintente. Se registra y se deja pasar para que no se quede
        # dando vueltas en la cola para siempre.
        print(f"[AVISO] Tipo desconocido, se descarta: {tipo}", flush=True)
        return

    momento = datetime.now(timezone.utc)
    mensaje = armar_mensaje(tipo, datos)

    print("=" * 70, flush=True)
    print(f"  NOTIFICACION [{tipo}]", flush=True)
    print(f"  Para:    {email}", flush=True)
    print(f"  Mensaje: {mensaje}", flush=True)
    print("=" * 70, flush=True)

    with conexion.cursor() as cursor:
        cursor.execute(
            "INSERT INTO notificaciones (fecha, tipo, email, mensaje, datos)"
            " VALUES (%s, %s, %s, %s, %s)",
            (momento, tipo, email, mensaje, Json(datos)),
        )
    conexion.commit()

    escribir_en_log(
        json.dumps(
            {
                "fecha": momento.isoformat(),
                "tipo": tipo,
                "email": email,
                "mensaje": mensaje,
                "datos": datos,
            },
            ensure_ascii=False,
        )
    )


def escuchar(conexion_bd) -> None:
    """Se conecta al broker y se queda escuchando la cola."""
    conexion = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    canal = conexion.channel()

    # durable=True es lo que hace que la cola sobreviva a un reinicio del
    # broker. Sin esto, los mensajes acumulados se perderian.
    canal.queue_declare(queue=COLA, durable=True)

    # Que RabbitMQ mande un mensaje a la vez. Sin esto le tiraria cientos
    # encima y si el proceso muere se perderia el trabajo de todos.
    canal.basic_qos(prefetch_count=1)

    def al_recibir(canal_actual, metodo, propiedades, cuerpo):
        tocar_latido()
        try:
            procesar(conexion_bd, cuerpo)
        except Exception as error:
            print(f"[ERROR] Fallo al procesar: {error}", flush=True)
            # requeue=True devuelve el mensaje a la cola. Es la red de
            # seguridad que evita perder informacion.
            canal_actual.basic_nack(delivery_tag=metodo.delivery_tag, requeue=True)
            return

        # ACK MANUAL: recien aqui, con el mensaje ya guardado, se le dice a
        # RabbitMQ que puede borrarlo. Si el proceso se cayera antes de esta
        # linea, el mensaje seguiria en la cola.
        canal_actual.basic_ack(delivery_tag=metodo.delivery_tag)

    canal.basic_consume(queue=COLA, on_message_callback=al_recibir)

    print(f"Escuchando la cola '{COLA}'. Esperando mensajes...", flush=True)
    tocar_latido()

    # En vez de start_consuming(), que bloquea para siempre, se atiende la
    # cola en tandas y entre tanda y tanda se refresca el latido. Sin esto,
    # una tienda sin trafico dejaria el archivo viejo y la probe de Kubernetes
    # mataria un consumidor que en realidad esta sano.
    while True:
        conexion.process_data_events(time_limit=SEGUNDOS_ENTRE_LATIDOS)
        tocar_latido()


def main() -> None:
    conexion_bd = psycopg2.connect(DATABASE_URL)
    crear_tabla(conexion_bd)

    # Bucle de reconexion: si el broker se cae o se reinicia, este proceso
    # espera y vuelve a intentar en vez de morirse. En Kubernetes el pod se
    # reiniciaria solo, pero reconectar es mas rapido que arrancar de cero.
    while True:
        try:
            escuchar(conexion_bd)
        except pika.exceptions.AMQPConnectionError as error:
            print(f"[AVISO] Sin conexion al broker: {error}. Reintento en 5s", flush=True)
            time.sleep(5)
        except KeyboardInterrupt:
            print("Cerrando el consumidor...", flush=True)
            conexion_bd.close()
            sys.exit(0)


if __name__ == "__main__":
    main()
