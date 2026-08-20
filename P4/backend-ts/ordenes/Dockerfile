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

# `--omit=dev` deja fuera el compilador de TypeScript, ESLint.
RUN npm ci --omit=dev

# Se trae únicamente el resultado de la compilación de la etapa anterior.
COPY --from=compilacion /app/dist ./dist

EXPOSE 3003

CMD ["node", "dist/main"]
