>Pront dicho a claude: okey tengo un plan que esta en claude.md guiate de ahi ahi estan las intrucciones detalladas y si tienes dudas preguntame antes de actuar, todas las intrucciones estan en el claude md aplica codigo seguro y limpio 

## 1. Contexto del proyecto

El CRUD ya está terminado y probado. Lo que falta es aplicar principios SOLID al código existente y documentarlo.
---

## 2. Stack y restricciones técnicas

- **Lenguaje:** TypeScript con `"strict": true`
- **Runtime:** Node.js
- **Framework HTTP:** Express
- **Base de datos:** PostgreSQL local, mediante el driver `pg` con `Pool`
- **Validación:** Zod
- **Configuración:** variables de entorno con `dotenv` (`DATABASE_URL`, `PORT`)

No agregues dependencias nuevas salvo que sean imprescindibles, y si lo haces, justifícalo.

---

### 3. Problemas que quiero corregir con la refactorización

1. **Un solo archivo hace todo.** `solicitudes.ts` mezcla el manejo de HTTP (leer `req`, escribir `res`, elegir códigos de estado), las reglas de negocio (las transiciones de estado permitidas) y el acceso a datos (las consultas SQL y el uso directo de `pool`).
2. **Duplicación entre esquemas.** El esquema de crear y el de actualizar declaran casi los mismos campos con las mismas reglas, copiados uno del otro.
3. **Acoplamiento directo a PostgreSQL.** Los handlers importan `pool` y escriben SQL en línea. No hay forma de cambiar el motor de base de datos ni de probar la lógica sin una base real levantada.

---

## 4. Tarea principal

Refactoriza el código aplicando **al menos 4 de los 5 principios SOLID**. No es obligatorio aplicar los cinco: es preferible aplicar cuatro de forma clara y justificada que forzar el quinto con un ejemplo artificial.

Antes de escribir código, indícame **qué principios vas a aplicar y en qué parte del proyecto**, para que yo los apruebe.

### Sugerencia de dónde cae cada letra en este proyecto

Es una guía, no una obligación. Si encuentras un mejor lugar, propónlo.

| Letra | Dónde encaja naturalmente aquí |
|---|---|
| **S** — Responsabilidad única | Separar en capas: controlador (HTTP) · servicio (reglas de negocio) · repositorio (acceso a datos) |
| **O** — Abierto/cerrado | Las transiciones de estado como una estructura de datos configurable, para agregar un estado nuevo sin modificar la lógica de validación |
| **L** — Sustitución de Liskov | Cualquier implementación del repositorio debe poder reemplazar a la de PostgreSQL sin romper al servicio |
| **I** — Segregación de interfaces | Interfaces pequeñas y específicas en vez de una única interfaz gigante que obligue a implementar métodos que no se usan |
| **D** — Inversión de dependencias | El servicio depende de una interfaz de repositorio, no de `pg` ni de `pool` |

### Restricciones de la refactorización

- **No sobre-ingeniería.** Es una práctica académica de una sola entidad, no un sistema empresarial. Nada de contenedores de inyección de dependencias, ni patrones adicionales, ni capas que no aporten. Si una abstracción no resuelve un problema real de este proyecto, no la agregues.
- **No cambies el contrato de la API.** Mismas rutas, mismos códigos, mismas respuestas.
- **Refactoriza de forma incremental.** Un principio a la vez, explicándome el cambio antes de aplicarlo. No reescribas todo de golpe.
- **Comentarios en español**, redactados para que se entiendan a nivel de estudiante.

---

## 5. Lo que NO debes hacer

- No reescribas el proyecto desde cero: refactoriza lo que ya existe.
- No agregues funcionalidad que la práctica no pidió (autenticación, paginación, filtros, tests de integración, Docker).
- No cambies rutas ni códigos de respuesta.
- No inventes fragmentos de código para el README: cópialos del proyecto real.
- No uses lenguaje inflado en la documentación. Describe lo que el código hace, sin adjetivos de más.