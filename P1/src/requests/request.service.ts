import { RequestRepository, RequestStatusRepository } from "./request.repository";
import { allowedNextStatuses, isTransitionAllowed } from "./request.transitions";
import { OperationalRequest, RequestInput, RequestStatus } from "./request.types";


export type ChangeStatusOutcome =
    | { result: "updated"; request: OperationalRequest }
    | { result: "not_found" }
    | {
          result: "invalid_transition";
          currentStatus: RequestStatus;
          allowedNext: readonly RequestStatus[];
      };

/**
 * [S] Responsabilidad única
 * Aquí viven las reglas de negocio de las solicitudes.
 * 
 * [D] Inversión de dependencias
 * Recibe los repositorios por constructor y los conoce únicamente a través de
 * sus interfaces.
 */
export class RequestService {
    constructor(
        private readonly repository: RequestRepository,
        private readonly statusRepository: RequestStatusRepository
    ) {}

    list(): Promise<OperationalRequest[]> {
        return this.repository.findAll();
    }

    create(input: RequestInput): Promise<OperationalRequest> {
        return this.repository.create(input);
    }

    update(id_request: string, input: RequestInput): Promise<OperationalRequest | null> {
        return this.repository.update(id_request, input);
    }

    remove(id_request: string): Promise<boolean> {
        return this.repository.delete(id_request);
    }

    
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
}
