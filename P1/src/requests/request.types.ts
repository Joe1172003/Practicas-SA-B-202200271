
export const REQUEST_STATUSES = ["registrada", "en_proceso", "finalizada"] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];


export interface OperationalRequest {
    id_request: string;
    title: string;
    area_request: string;
    priority: number;
    estimated_cost: number;
    status: RequestStatus;
    create_in: Date;
    update_in: Date;
}


export interface RequestInput {
    title: string;
    area_request: string;
    priority: number;
    estimated_cost: number;
    status: RequestStatus;
}
