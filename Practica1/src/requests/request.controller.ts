import { Response, Router } from "express";
import { z } from "zod";
import { RequestService } from "./request.service";
import {
    changeStatusSchema,
    createRequestSchema,
    requestIdSchema,
    updateRequestSchema
} from "./request.schemas";

/**
 * [S] Responsabilidad única
 * Esta capa solo traduce entre HTTP y el servicio: lee `req`, valida la
 * entrada, llama al servicio y elige el código de respuesta. No conoce SQL ni
 * las reglas de transición de estados.
 */

function sendValidationError<T>(res: Response, error: z.ZodError<T>): void {
    res.status(400).json({
        error: "data invalid",
        details: error.issues.map((problem) => ({
            field: problem.path.join("."),
            message: problem.message
        }))
    });
}

function sendServerError(res: Response, context: string, error: unknown): void {
    console.error(context, error);
    res.status(500).json({ error: "Internal server error" });
}

/**
 * [D] Inversión de dependencias
 * El router recibe el servicio ya construido en vez de crearlo. Así el
 * controlador no decide qué repositorio se usa ni conoce el Pool.
 */
export function createRequestRouter(service: RequestService): Router {
    const router = Router();

    router.get("/", async (_req, res) => {
        try {
            const requests = await service.list();
            res.status(200).json(requests);
        } catch (error) {
            sendServerError(res, "Error get the all request", error);
        }
    });

    router.post("/", async (req, res) => {
        const validation = createRequestSchema.safeParse(req.body);
        if (!validation.success) {
            return sendValidationError(res, validation.error);
        }

        try {
            const created = await service.create(validation.data);
            res.status(201).json(created);
        } catch (error) {
            sendServerError(res, "Error to register the request", error);
        }
    });

    router.put("/:id_request", async (req, res) => {
        const idValidation = requestIdSchema.safeParse(req.params.id_request);
        if (!idValidation.success) {
            return res.status(400).json({ error: "id_request not valid" });
        }

        const validation = updateRequestSchema.safeParse(req.body);
        if (!validation.success) {
            return sendValidationError(res, validation.error);
        }

        try {
            const updated = await service.update(idValidation.data, validation.data);

            if (updated === null) {
                return res.status(404).json({ error: "Request not found" });
            }

            res.status(200).json(updated);
        } catch (error) {
            sendServerError(res, "Error to update request:", error);
        }
    });

    router.patch("/:id_request/status", async (req, res) => {
        const idValidation = requestIdSchema.safeParse(req.params.id_request);
        if (!idValidation.success) {
            return res.status(400).json({ error: "id_request not valid" });
        }

        const validation = changeStatusSchema.safeParse(req.body);
        if (!validation.success) {
            return sendValidationError(res, validation.error);
        }

        try {
            const outcome = await service.changeStatus(idValidation.data, validation.data.status);

            if (outcome.result === "not_found") {
                return res.status(404).json({ error: "Request not found" });
            }

            if (outcome.result === "invalid_transition") {
                return res.status(409).json({
                    error: `Not allowed to go from '${outcome.currentStatus}' to '${validation.data.status}'`,
                    valid_transitions: outcome.allowedNext
                });
            }

            res.status(200).json(outcome.request);
        } catch (error) {
            sendServerError(res, "Error to update the status:", error);
        }
    });

    router.delete("/:id_request", async (req, res) => {
        const idValidation = requestIdSchema.safeParse(req.params.id_request);
        if (!idValidation.success) {
            return res.status(400).json({ error: "id_request not valid" });
        }

        try {
            const removed = await service.remove(idValidation.data);

            if (!removed) {
                return res.status(404).json({ error: "Request not found" });
            }

            res.status(204).send();
        } catch (error) {
            sendServerError(res, "Error to delete the request", error);
        }
    });

    return router;
}
