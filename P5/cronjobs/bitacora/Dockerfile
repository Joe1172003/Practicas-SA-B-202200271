FROM python:3.11-slim AS compilacion

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir --prefix=/dependencias -r requirements.txt

FROM python:3.11-slim

WORKDIR /app

COPY --from=compilacion /dependencias /usr/local

COPY main.py ./

RUN useradd --uid 10002 --create-home --shell /usr/sbin/nologin cron \
    && chown -R 10002:10002 /app

USER 10002

CMD ["python", "main.py"]
