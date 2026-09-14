FROM python:3.11-slim AS compilacion

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir --prefix=/dependencias -r requirements.txt

FROM python:3.11-slim

WORKDIR /app

# Parches de seguridad de Debian que python:3.11-slim todavia no trae. Sin esto
# Trivy encuentra 3 vulnerabilidades criticas en perl-base y bloquea la version.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=compilacion /dependencias /usr/local

COPY main.py ./

RUN useradd --uid 10002 --create-home --shell /usr/sbin/nologin cron \
    && chown -R 10002:10002 /app

USER 10002

CMD ["python", "main.py"]
