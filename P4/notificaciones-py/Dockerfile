FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY main.py latido.py ./

# CAMBIO DE LA P5: crear un usuario sin privilegios y correr con el.
#
# Por defecto un contenedor corre como root. Si alguien logra escaparse del
# contenedor, lo hace siendo administrador de la maquina. Kubernetes lo va a
# exigir con "runAsNonRoot: true", y sin este USER el pod ni siquiera
# arrancaria.
#
# El uid 10001 va explicito porque Kubernetes compara numeros, no nombres:
# necesita un uid distinto de 0 para dejarlo pasar.
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app \
    && chown -R app:app /app

USER 10001

# Ya no hay puerto que exponer: este servicio no escucha, se conecta al broker.
CMD ["python", "main.py"]
