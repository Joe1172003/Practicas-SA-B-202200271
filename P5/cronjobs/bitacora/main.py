"""
Cronjob 1 que hace mi cronjob
Cada 2 minutos dejo constancia de que se ejecuto: guarda la fecha y hora 
junto con mi carnet 202200271. El cronjob 2 lee estos registros.
Corre, escribe una fila y termina. No es un servicio: el pod muere al acabar.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

import psycopg2

DATABASE_URL = os.environ["DATABASE_URL"]
CARNE = os.environ["CARNE"]

GMT_MENOS_6 = timezone(timedelta(hours=-6))


def crear_tabla(conexion) -> None:
    with conexion.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS bitacora (
                id SERIAL PRIMARY KEY,
                fecha_ejecucion TIMESTAMPTZ NOT NULL,
                carne VARCHAR(20) NOT NULL
            )
            """
        )
    conexion.commit()


def registrar(conexion, momento: datetime) -> int:
    with conexion.cursor() as cursor:
        cursor.execute(
            "INSERT INTO bitacora (fecha_ejecucion, carne) VALUES (%s, %s) RETURNING id",
            (momento, CARNE),
        )
        fila = cursor.fetchone()[0]
    # Sin este commit la fila se pierde al cerrar la conexion, aunque RETURNING
    # ya haya devuelto un id: psycopg2 abre una transaccion y la revierte al salir.
    conexion.commit()
    return fila


def main() -> None:
    momento = datetime.now(GMT_MENOS_6)

    try:
        conexion = psycopg2.connect(DATABASE_URL)
    except psycopg2.Error as error:
        # Salir con codigo distinto de 0 hace que Kubernetes cuente el intento
        # como fallido y aplique backoffLimit.
        print(f"[ERROR] Sin conexion a la base: {error}", flush=True)
        sys.exit(1)

    try:
        crear_tabla(conexion)
        fila = registrar(conexion, momento)
        print( f"Bitacora #{fila}: {momento.isoformat()} | carne {CARNE}", flush=True)
    except psycopg2.Error as error:
        print(f"[ERROR] Fallo al insertar: {error}", flush=True)
        conexion.close()
        sys.exit(1)

    conexion.close()


if __name__ == "__main__":
    main()
