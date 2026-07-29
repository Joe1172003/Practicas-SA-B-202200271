import { z } from "zod";
import { REQUEST_STATUSES } from "./request.types";

/**
 * [S] Responsabilidad única: este archivo solo decide qué entrada es aceptable.
 * No consulta la base de datos ni arma respuestas.
 */

const requestFields = {
    title: z.string().trim().min(4).max(100),
    area_request: z.string().trim().min(4).max(100),
    priority: z.number().int().min(1).max(5),
    estimated_cost: z.number().min(0)
};

const statusSchema = z.enum(REQUEST_STATUSES);

export const createRequestSchema = z
    .object({
        ...requestFields,
        status: statusSchema.default("registrada")
    })
    .strict();

export const updateRequestSchema = z
    .object({
        ...requestFields,
        status: statusSchema
    })
    .strict();

export const changeStatusSchema = z
    .object({
        status: statusSchema
    })
    .strict();

export const requestIdSchema = z.string().uuid();
