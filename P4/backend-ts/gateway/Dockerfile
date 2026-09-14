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
# Despues borro npm: la imagen final solo necesita node para arrancar, y el npm
# que trae node:22-alpine arrastra un tar con una vulnerabilidad critica
# (CVE-2026-59873) que hace que Trivy bloquee la version.
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=compilacion /app/dist ./dist

EXPOSE 3000

RUN chown -R 1000:1000 /app
USER 1000

CMD ["node", "dist/main"]
