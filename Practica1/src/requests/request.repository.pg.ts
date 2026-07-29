import { Pool, PoolClient } from "pg";
import {
    RequestRepository,
    RequestStatusRepository,
    StatusChangeResult
} from "./request.repository";
import {
    OperationalRequest,
    RequestInput,
    RequestStatus,
    REQUEST_STATUSES
} from "./request.types";

const RETURNED_COLUMNS = `id_request, title, area_request, "priority", estimated_cost, "status", create_in, update_in`;

interface RequestRow {
    id_request: string;
    title: string;
    area_request: string;
    priority: number;
    estimated_cost: string;
    status: string;
    create_in: Date;
    update_in: Date;
}

function toRequestStatus(value: string): RequestStatus {
    if ((REQUEST_STATUSES as readonly string[]).includes(value)) {
        return value as RequestStatus;
    }
    throw new Error(`Estado desconocido en la base de datos: ${value}`);
}

// [S] Responsabilidad única: esta función solo traduce fila de BD a objeto de dominio.
function mapRowToRequest(row: RequestRow): OperationalRequest {
    return {
        id_request: row.id_request,
        title: row.title,
        area_request: row.area_request,
        priority: row.priority,
        estimated_cost: Number(row.estimated_cost),
        status: toRequestStatus(row.status),
        create_in: row.create_in,
        update_in: row.update_in
    };
}

async function rollbackQuietly(connection: PoolClient): Promise<void> {
    try {
        await connection.query("ROLLBACK");
    } catch (error) {
        console.error("Error al hacer ROLLBACK:", error);
    }
}

/**
 * [S] Responsabilidad única
 * Este archivo es el único que sabe SQL y el único que conoce el driver `pg`.
 * Cambia si cambia la tabla o el motor de base de datos, por ninguna otra razón.
 *
 * [L] Sustitución de Liskov
 * Cumple los contratos declarados en las interfaces sin endurecerlos
 */
export class PgRequestRepository implements RequestRepository, RequestStatusRepository {
    constructor(private readonly pool: Pool) {}

    async findAll(): Promise<OperationalRequest[]> {
        const result = await this.pool.query<RequestRow>(
            `SELECT ${RETURNED_COLUMNS}
               FROM Operational_requests
              ORDER BY create_in DESC`
        );
        return result.rows.map(mapRowToRequest);
    }

    async create(input: RequestInput): Promise<OperationalRequest> {
        const result = await this.pool.query<RequestRow>(
            `INSERT INTO Operational_requests
                    (title, area_request, "priority", estimated_cost, "status")
             VALUES ($1, $2, $3, $4, $5)
             RETURNING ${RETURNED_COLUMNS}`,
            [input.title, input.area_request, input.priority, input.estimated_cost, input.status]
        );
        return mapRowToRequest(result.rows[0]);
    }

    async update(id_request: string, input: RequestInput): Promise<OperationalRequest | null> {
        const result = await this.pool.query<RequestRow>(
            `UPDATE Operational_requests
                SET title = $1,
                    area_request = $2,
                    "priority" = $3,
                    estimated_cost = $4,
                    "status" = $5,
                    update_in = now()
              WHERE id_request = $6
             RETURNING ${RETURNED_COLUMNS}`,
            [
                input.title,
                input.area_request,
                input.priority,
                input.estimated_cost,
                input.status,
                id_request
            ]
        );

        if (result.rowCount === 0) {
            return null;
        }
        return mapRowToRequest(result.rows[0]);
    }

    async delete(id_request: string): Promise<boolean> {
        const result = await this.pool.query(
            `DELETE FROM Operational_requests
              WHERE id_request = $1`,
            [id_request]
        );
        return result.rowCount !== 0;
    }

    async changeStatus(
        id_request: string,
        newStatus: RequestStatus,
        isAllowed: (currentStatus: RequestStatus) => boolean
    ): Promise<StatusChangeResult> {
        const connection = await this.pool.connect();

        try {
            await connection.query("BEGIN");

            const locked = await connection.query<{ status: string }>(
                `SELECT "status"
                   FROM Operational_requests
                  WHERE id_request = $1
                    FOR UPDATE`,
                [id_request]
            );

            if (locked.rowCount === 0) {
                await connection.query("ROLLBACK");
                return { outcome: "not_found" };
            }

            const currentStatus = toRequestStatus(locked.rows[0].status);

            if (!isAllowed(currentStatus)) {
                await connection.query("ROLLBACK");
                return { outcome: "rejected", currentStatus };
            }

            const updated = await connection.query<RequestRow>(
                `UPDATE Operational_requests
                    SET "status" = $1,
                        update_in = now()
                  WHERE id_request = $2
                 RETURNING ${RETURNED_COLUMNS}`,
                [newStatus, id_request]
            );

            await connection.query("COMMIT");
            return { outcome: "updated", request: mapRowToRequest(updated.rows[0]) };
        } catch (error) {
            await rollbackQuietly(connection);
            throw error;
        } finally {
            connection.release();
        }
    }
}
