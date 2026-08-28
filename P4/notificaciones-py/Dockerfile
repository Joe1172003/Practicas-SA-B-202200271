FROM python:3.11-slim AS compilacion

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir --prefix=/dependencias -r requirements.txt

# ejecucion: solo el interprete, las librerias y el codigo
FROM python:3.11-slim

WORKDIR /app

COPY --from=compilacion /dependencias /usr/local

COPY main.py latido.py ./

RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app \
    && chown -R 10001:10001 /app

USER 10001

# No expone puerto: este servicio no escucha, se conecta al broker.
CMD ["python", "main.py"]
