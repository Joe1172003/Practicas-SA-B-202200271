# Backend — Práctica 2

API REST de autenticación y autorización construida con NestJS.

**La documentación completa está en [`../README.md`](../README.md)**:
tecnologías y sus ventajas/desventajas, explicación de JWT, AES y cookies
HTTP-only, diagramas de secuencia e instrucciones de ejecución.

## Arranque rápido

> Nota: recordar tener el .env creado para la parte de levantar el proyecto
```bash
npm install
npm run start:dev
```

La API queda en <http://localhost:3000>. Comprueba con:

```bash
curl http://localhost:3000/health
```

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Levanta la API recargando al guardar |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta lo compilado |
| `npm run lint` | Revisa y corrige el estilo |
| `npm run ver:datos` | Muestra la tabla `users` en crudo, para comprobar que todo está cifrado |
