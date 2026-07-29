# API de Solicitudes Operativas

API REST para administrar solicitudes operativas: crearlas, listarlas, modificarlas, eliminarlas y avanzar su estado siguiendo un flujo controlado.

Construida con TypeScript en modo `strict`, Express, PostgreSQL a través del driver `pg` y validación de entrada con Zod.

---

## Principios SOLID

### S — Responsabilidad única

**Qué significa.** Cada archivo o clase debe tener un solo motivo por el cual alguien vaya a modificarlo. Si un archivo cambia tanto cuando se rediseña la API como cuando se renombra una columna de la base, tiene dos trabajos y conviene partirlo.

**Analogía.** En un restaurante el mesero toma el pedido, el cocinero cocina y el bodeguero surte los ingredientes. Si el mesero hiciera las tres cosas, cambiar de proveedor obligaría a reentrenar también a quien atiende las mesas.

**Dónde se aplicó.** Antes existía un solo archivo, `src/solicitudes.ts`, que leía `req`, elegía códigos HTTP, decidía si una transición de estado era legal y además escribía SQL. Se dividió en tres capas. El ejemplo más claro es el cambio de estado: el servicio decide *qué pasó* en términos de negocio, sin mencionar ni un número de HTTP.

`src/requests/request.service.ts`, método `RequestService.changeStatus`:

```ts
    async changeStatus(id_request: string, newStatus: RequestStatus): Promise<ChangeStatusOutcome> {
        const change = await this.statusRepository.changeStatus(
            id_request,
            newStatus,
            (currentStatus) => isTransitionAllowed(currentStatus, newStatus)
        );

        if (change.outcome === "not_found") {
            return { result: "not_found" };
        }

        if (change.outcome === "rejected") {
            // El repositorio informa desde qué estado se rechazó; el servicio
            // es quien sabe cuáles habrían sido las alternativas válidas.
            return {
                result: "invalid_transition",
                currentStatus: change.currentStatus,
                allowedNext: allowedNextStatuses(change.currentStatus)
            };
        }

        return { result: "updated", request: change.request };
    }
```

Y `src/requests/request.controller.ts` es el único que traduce eso a códigos de respuesta:

```ts
            if (outcome.result === "not_found") {
                return res.status(404).json({ error: "Request not found" });
            }

            // 409 Conflict: la petición está bien formada, pero choca con el
            // estado actual del recurso. Por eso no es un 400.
            if (outcome.result === "invalid_transition") {
                return res.status(409).json({
                    error: `Not allowed to go from '${outcome.currentStatus}' to '${validation.data.status}'`,
                    valid_transitions: outcome.allowedNext
                });
            }
```

**Por qué evidencia el principio.** Si mañana se decide que una transición ilegal debe responder `422` en vez de `409`, solo cambia el controlador. Si se agrega una regla de negocio nueva, solo cambia el servicio. Ninguno de los dos archivos tiene que tocarse por el motivo del otro.

---

### O — Abierto/cerrado

**Qué significa.** Debería poder agregarse comportamiento nuevo sin editar el código que ya funciona y está probado. Se extiende, no se modifica.

**Analogía.** Un tomacorriente permite conectar un aparato nuevo sin volver a abrir la pared para tocar el cableado.

**Dónde se aplicó.** Las transiciones válidas se guardan como un dato, no como una cadena de `if`.
Archivo completo `src/requests/request.transitions.ts`:

```ts
export const ALLOWED_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
    registrada: ["en_proceso"],
    en_proceso: ["finalizada"],
    finalizada: []
};

/**
 * Devuelve a qué estados se puede pasar desde `from`.
 * El `?? []` es una red de seguridad: si algún día llegara un estado que no
 * está en la tabla, se responde "ninguna transición posible" en vez de
 * reventar con un TypeError y devolver un 500.
 */
export function allowedNextStatuses(from: RequestStatus): readonly RequestStatus[] {
    return ALLOWED_TRANSITIONS[from] ?? [];
}

// Única fuente de verdad sobre si un cambio de estado es legal.
export function isTransitionAllowed(from: RequestStatus, to: RequestStatus): boolean {
    return allowedNextStatuses(from).includes(to);
}
```

**Por qué evidencia el principio.** Para agregar un estado `cancelada` basta con incluirlo en `REQUEST_STATUSES` y añadir su fila a esta tabla. Ni `isTransitionAllowed`, ni el servicio, ni el controlador, ni el SQL cambian. Además, como el tipo es `Record<RequestStatus, ...>`, si se agrega el estado al dominio y se olvida registrarlo aquí, **el proyecto no compila**: el compilador obliga a completar la extensión.

---

### L — Sustitución de Liskov

**Qué significa.** Si algo se declara como cierto tipo, cualquier implementación de ese tipo debe poder ocupar su lugar sin que quien la usa tenga que enterarse de cuál le tocó. No basta con tener los mismos métodos: hay que comportarse como se prometió.

**Analogía.** Si un cargador dice "USB-C de 20 W", cualquier cargador con esa etiqueta debería servir. Uno que encaje físicamente pero apague el teléfono cumple la forma y rompe el contrato.

Si defino un tipo T (una interfaz) y después una implementación concreta dice cumplir T, esa implementación tiene que comportarse exactamente como el contrato de T promete — no solo tener la misma forma — para que no haya falsos negativos.

**Dónde se aplicó.** El contrato se declara explícitamente en `src/requests/request.repository.ts`, para que no quede a interpretación de quien implemente:

```ts
/**
 * [L] Sustitución de Liskov
 * El contrato que toda implementación debe respetar para ser intercambiable:
 *  - "no encontrado" se comunica devolviendo `null` o `false`, nunca lanzando.
 *  - solo se lanza cuando falla la infraestructura (conexión caída, SQL inválido).
 *  - los métodos devuelven la solicitud ya guardada, con `update_in` actualizado.
 * Una implementación que lanzara un error al no encontrar un id rompería al
 * servicio, porque el servicio confía en estas reglas y no pregunta con qué
 * implementación está hablando.
 */
export interface RequestRepository {
    findAll(): Promise<OperationalRequest[]>;

    create(input: RequestInput): Promise<OperationalRequest>;

    /** Devuelve `null` si el id no existe. */
    update(id_request: string, input: RequestInput): Promise<OperationalRequest | null>;

    /** Devuelve `false` si el id no existe. */
    delete(id_request: string): Promise<boolean>;
}
```

Y `PgRequestRepository` lo respeta al pie de la letra, sin endurecer condiciones:

```ts
    async delete(id_request: string): Promise<boolean> {
        const result = await this.pool.query(
            `DELETE FROM Operational_requests
              WHERE id_request = $1`,
            [id_request]
        );
        return result.rowCount !== 0;
    }
```

**Por qué evidencia el principio.** En ninguna parte del servicio hay un `instanceof` ni una comprobación de qué repositorio llegó: se limita a confiar en el contrato. Un `delete` que lanzara una excepción en vez de devolver `false` compilaría igual, pero convertiría un `404` legítimo en un `500`. Documentar el contrato es lo que hace que la sustitución sea realmente segura y no solo una coincidencia de firmas.

---

### I — Segregación de interfaces

**Qué significa.** Es preferible tener varias interfaces pequeñas y enfocadas que una sola muy grande. Nadie debería verse obligado a implementar métodos que no le sirven.

**Analogía.** Un control remoto con sesenta botones cuando solo se usan cuatro. Dos controles pequeños y claros funcionan mejor que uno lleno de funciones ajenas.

**Dónde se aplicó.** El cambio de estado quedó en su propia interfaz, en `src/requests/request.repository.ts`:

```ts
/**
 * [I] Segregación de interfaces
 * El cambio de estado no vive en RequestRepository porque necesita algo que
 * ninguna otra operación necesita: leer y escribir dentro de una misma
 * transacción con la fila bloqueada.
 *
 * Separarlo evita que una implementación que solo sirva para listar o crear
 * quede obligada a montar toda esa maquinaria transaccional, y deja claro que
 * el único consumidor de este contrato es el cambio de estado.
 */
export interface RequestStatusRepository {
    /**
     * Bloquea la fila, le pregunta a `isAllowed` si el estado actual admite el
     * cambio y solo entonces escribe. Todo dentro de una transacción, así que
     * dos peticiones simultáneas no pueden leer el mismo estado y pisarse.
     *
     * La REGLA de qué transición es legal no está aquí: llega como función
     * desde el servicio. El repositorio solo aporta la transacción y el bloqueo.
     */
    changeStatus(
        id_request: string,
        newStatus: RequestStatus,
        isAllowed: (currentStatus: RequestStatus) => boolean
    ): Promise<StatusChangeResult>;
}
```

**Por qué evidencia el principio.** La separación no es arbitraria: `changeStatus` tiene una firma que ninguna otra operación comparte, porque recibe la regla de negocio como función para poder evaluarla con la fila ya bloqueada dentro de la transacción. Las otras cuatro operaciones son consultas sueltas y no necesitan nada de eso.

---

### D — Inversión de dependencias

**Qué significa.** La lógica importante no debe depender de los detalles técnicos. Ambos deben apoyarse en una abstracción compartida. En la práctica: la regla de negocio define qué necesita, y la base de datos se acomoda a eso, no al revés.

**Analogía.** Una lámpara no viene soldada al cableado de la casa. La lámpara y la instalación eléctrica se ponen de acuerdo en un estándar —el enchufe— y por eso se puede cambiar cualquiera de los dos por separado.

**Dónde se aplicó.** `RequestService` no importa `pg` ni el `Pool`. Recibe lo que necesita, tipado con interfaces:

```ts
export class RequestService {
    constructor(
        private readonly repository: RequestRepository,
        private readonly statusRepository: RequestStatusRepository
    ) {}
```

La decisión de usar PostgreSQL se toma en un único lugar de todo el proyecto, `src/index.ts`:

```ts
const requestRepository = new PgRequestRepository(pool);
const requestService = new RequestService(requestRepository, requestRepository);

app.use("/api/request", createRequestRouter(requestService));
```

**Por qué evidencia el principio.** Cambiar de motor de base de datos significa escribir una clase nueva que cumpla `RequestRepository` y `RequestStatusRepository` y sustituir esas dos líneas. Ni el servicio ni el controlador se enteran. Se resolvió con paso de parámetros por constructor, sin contenedor de inyección de dependencias, porque en un proyecto de esta escala una librería para eso sería peso muerto.

El repositorio se pasa dos veces porque una misma clase cumple ambas interfaces; el servicio las sigue viendo como contratos separados.


