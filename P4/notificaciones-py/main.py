import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, Query
from pydantic import BaseModel, EmailStr, Field

# La ruta del log sale de una variable de entorno para no quemarla en el
# código. En docker-compose esta carpeta está montada contra el disco de la
# máquina, así que el archivo se puede abrir sin entrar al contenedor.
ARCHIVO_LOG = Path(os.environ.get("ARCHIVO_LOG", "/app/logs/notificaciones.log"))

app = FastAPI()


class Notificacion(BaseModel):
    # El contrato con los otros microservicios.

    tipo: Literal["usuario_registrado", "orden_pagada", "orden_cancelada"]
    email: EmailStr
    datos: dict[str, Any] = Field(default_factory=dict)


# Convierte la notificación en el texto que vería el usuario.
def armar_mensaje(n: Notificacion) -> str:

    if n.tipo == "usuario_registrado":
        nombre = n.datos.get("nombre", "usuario")
        return f"¡Bienvenido a la tienda, {nombre}! Tu cuenta quedo creada exitosamente."

    if n.tipo == "orden_pagada":
        orden = n.datos.get("ordenId", "?")
        total = n.datos.get("total", 0)
        return (
            f"Tu pago se confirmó. Orden {orden} por Q{total}. "
            f"Ya estamos preparando tu pedido."
        )

    # orden_cancelada: es el único que queda, gracias al Literal de arriba.
    orden = n.datos.get("ordenId", "?")
    motivo = n.datos.get("motivo", "sin motivo")
    return f"Tu orden {orden} fue cancelada. Motivo: {motivo}"


def escribir_en_log(linea: str) -> None:
    try:
        ARCHIVO_LOG.parent.mkdir(parents=True, exist_ok=True)

        with ARCHIVO_LOG.open("a", encoding="utf-8") as archivo:
            archivo.write(linea + "\n")
    except OSError as error:
        print(f"[AVISO] No se pudo escribir en {ARCHIVO_LOG}: {error}", flush=True)


@app.post("/interno/notificar")
def notificar(notificacion: Notificacion) -> dict[str, Any]:
    """
    El único endpoint del servicio. Lo llaman Auth (al registrar un usuario) y
    Órdenes (al pagar o cancelar una orden).

    Va bajo /interno porque el gateway no lo enruta: ningún cliente de afuera
    debería poder disparar notificaciones a nombre de otro.
    """
    momento = datetime.now(timezone.utc).isoformat()
    mensaje = armar_mensaje(notificacion)

    # En el archivo se guarda como JSON en una línea (formato JSON Lines).
    # Es más fácil de procesar después que el texto bonito de arriba.
    escribir_en_log(
        json.dumps(
            {
                "fecha": momento,
                "tipo": notificacion.tipo,
                "email": notificacion.email,
                "mensaje": mensaje,
                "datos": notificacion.datos,
            },
            ensure_ascii=False,
        )
    )

    return {"ok": True, "mensaje": mensaje}


def leer_historial() -> list[dict[str, Any]]:
    if not ARCHIVO_LOG.exists():
        return []

    registros: list[dict[str, Any]] = []

    try:
        with ARCHIVO_LOG.open("r", encoding="utf-8") as archivo:
            for linea in archivo:
                linea = linea.strip()

                if not linea:
                    continue

                try:
                    registros.append(json.loads(linea))
                except json.JSONDecodeError:
                    # Una línea corrupta (ejemplo: el contenedor murió a mitad de
                    # escritura) no debe tumbar toda la consulta. Se salta.
                    continue
    except OSError as error:
        print(f"[AVISO] No se pudo leer {ARCHIVO_LOG}: {error}", flush=True)

    return registros


@app.get("/notificaciones")
def listar_notificaciones( email: str, limite: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:

    propias = [
        registro for registro in leer_historial() if registro.get("email") == email
    ]

    # Las más recientes primero, que es como uno espera ver un historial.
    propias.reverse()

    return {
        "email": email,
        "total": len(propias),
        "notificaciones": propias[:limite],
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "estado": "ok",
        "servicio": "notificaciones",
        "hora": datetime.now(timezone.utc).isoformat(),
    }
