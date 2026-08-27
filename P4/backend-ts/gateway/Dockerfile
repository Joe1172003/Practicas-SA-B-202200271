# compilar
FROM node:22-alpine AS compilacion

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ejecutar
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=compilacion /app/dist ./dist

EXPOSE 3000

# CAMBIO DE LA P5: correr como usuario sin privilegios.
#
# Por defecto un contenedor corre como root. Si alguien logra escaparse del
# contenedor, lo hace siendo administrador de la maquina. Kubernetes lo va a
# exigir con "runAsNonRoot: true", y sin este USER el pod ni siquiera
# arrancaria.
#
# La imagen de node ya trae un usuario "node" con uid 1000. Kubernetes
# compara numeros y no nombres, asi que basta con que sea distinto de 0.
RUN chown -R node:node /app
USER node

CMD ["node", "dist/main"]
