# primero se compila el código TypeScript a JavaScript
FROM node:22-alpine AS compilacion

WORKDIR /app


COPY package.json package-lock.json ./

# instalar dependencias de producción y desarrollo
RUN npm ci


COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Segunda etapa: ejecutar el codigo compilado
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./

# --omit=dev deja fuera el compilador de TypeScript, ESLint.
RUN npm ci --omit=dev

# Se trae únicamente el resultado de la compilación de la etapa anterior.
COPY --from=compilacion /app/dist ./dist

# microservicio de autenticación escucha en el puerto 3001, 
# y el gateway lo redirige al puerto 3000
EXPOSE 3001

CMD ["node", "dist/main"]
