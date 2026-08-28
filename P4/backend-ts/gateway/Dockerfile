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

RUN chown -R 1000:1000 /app
USER 1000

CMD ["node", "dist/main"]
