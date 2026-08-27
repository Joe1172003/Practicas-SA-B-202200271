"""
Comprueba que el consumidor siga vivo.

Como este servicio ya no tiene endpoint HTTP, la salud se mide de otra
forma: main.py toca un archivo cada vez que recibe un mensaje o arranca, y
aqui se revisa que ese archivo sea reciente.

Sale con codigo 0 si esta sano y 1 si no. Eso es lo unico que miran tanto
el healthcheck de docker-compose como la probe de Kubernetes.
"""

import os
import sys
import time
from pathlib import Path

ARCHIVO_LATIDO = Path(os.environ.get("ARCHIVO_LATIDO", "/tmp/latido"))

# Cuanto puede pasar sin latido antes de darlo por muerto. Se toma amplio a
# proposito: en una tienda sin trafico el consumidor puede pasar horas sin
# recibir nada, y eso no significa que este colgado.
SEGUNDOS_TOLERANCIA = int(os.environ.get("LATIDO_TOLERANCIA", "300"))

if not ARCHIVO_LATIDO.exists():
    print("Sin archivo de latido: el consumidor todavia no arranco")
    sys.exit(1)

antiguedad = time.time() - ARCHIVO_LATIDO.stat().st_mtime

if antiguedad > SEGUNDOS_TOLERANCIA:
    print(f"Latido viejo: {int(antiguedad)}s sin señal")
    sys.exit(1)

print(f"Vivo. Ultimo latido hace {int(antiguedad)}s")
sys.exit(0)
