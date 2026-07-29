import { OperationalRequest, RequestInput, RequestStatus } from "./request.types";


export type StatusChangeResult =
    | { outcome: "updated"; request: OperationalRequest }
    | { outcome: "not_found" }
    | { outcome: "rejected"; currentStatus: RequestStatus };

/**  
 * [D] Inversión de dependencias
 * El servicio depende de esta interfaz.
 * Cambiar PostgreSQL por otro motor significa escribir otra clase que cumpla
 * este contrato, sin tocar ni una línea de las reglas de negocio.
 *
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

    update(id_request: string, input: RequestInput): Promise<OperationalRequest | null>;

    delete(id_request: string): Promise<boolean>;
}

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
    changeStatus(
        id_request: string,
        newStatus: RequestStatus,
        isAllowed: (currentStatus: RequestStatus) => boolean
    ): Promise<StatusChangeResult>;
}
