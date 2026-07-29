import { RequestStatus } from "./request.types";

/**
 * [O] Abierto/cerrado
 * Las transiciones permitidas son un DATO, no una cadena de if/else.
 * Para agregar un estado nuevo por ejemplo "cancelado" basta con agregar una
   entrada a esta tabla: ni `isTransitionAllowed` ni el servicio ni el controlador cambian una sola línea.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
    registrada: ["en_proceso"],
    en_proceso: ["finalizada"],
    finalizada: [],
};

export function allowedNextStatuses(from: RequestStatus): readonly RequestStatus[] {
    return ALLOWED_TRANSITIONS[from] ?? [];
}

export function isTransitionAllowed(from: RequestStatus, to: RequestStatus): boolean {
    return allowedNextStatuses(from).includes(to);
}
