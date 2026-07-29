import { Router } from "express";
import { pool } from "./connection";
import z from "zod";
export const routerRequest = Router();

interface RowRequesst {
    id_request: string,
    title: string,
    area_request: string,
    priority: number,
    estimated_cost: string,
    status: string,
    create_in: Date,
    update_in: Date
}

const mapRequest = (row: RowRequesst) => {
    return {
        id_request: row.id_request,
        title: row.title,
        area_request: row.area_request,
        priority: row.priority,
        estimated_cost: Number(row.estimated_cost),
        status: row.status,
        create_in: row.create_in,
        update_in: row.update_in
    }
}

// schemas 
const schemaCreateRequest = z
    .object({
        title: z.string().trim().min(4).max(100),
        area_request: z.string().trim().min(4).max(100),
        priority: z.number().int().min(1).max(5),
        estimated_cost: z.number().int(),
        status: z.enum(["registrada", "en_proceso", "finalizada"]).default("registrada")
    }).strict();

const schemaIdRequest = z.string().uuid();


const schemaUpdateRequest = z
    .object({
        title: z.string().trim().min(4).max(100),
        area_request: z.string().trim().min(4).max(100),
        priority: z.number().int().min(1).max(5),
        estimated_cost: z.number().int(),
        status: z.enum(["registrada", "en_proceso", "finalizada"])
    }).strict();

const schemasStatus = z
    .object({
        status: z.enum(["registrada", "en_proceso", "finalizada"])
    }).strict();

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    registrada: ["en_proceso"],
    en_proceso: ["finalizada"],
    finalizada: []
}


// routes request 
routerRequest.get("/", async(req, res) =>{
    try {
        const res_query = await pool.query<RowRequesst>(
            `SELECT id_request, 
                    title,
                    area_request,
                    "priority",
                    estimated_cost,
                    "status",
                    create_in,
                    update_in
            FROM Operational_requests
            ORDER BY create_in DESC`
        )
        res.status(200).json(res_query.rows.map(mapRequest));
    } catch (err) {
        console.error("Error get the all request", err);
        res.status(500).json({error: "Internal server error"});
    }
})

routerRequest.post("/", async(req, res)=> {
    const validation = schemaCreateRequest.safeParse(req.body)
    if(!validation.success){
        return res.status(400).json({
            error: "data invalid",
            details: validation.error.issues.map((problem) => ({
                field: problem.path.join("."),
                message: problem.message
            }))
        })
    }

    const {title, area_request, priority, estimated_cost, status} = validation.data
    try {
        const req_query = await pool.query<RowRequesst>(
            `INSERT INTO Operational_requests 
                (title, area_request, "priority", estimated_cost, "status")
                VALUES($1, $2, $3, $4, $5)
                RETURNING id_request, title, area_request, "priority", estimated_cost, "status", create_in, update_in`,
                [title, area_request, priority, estimated_cost, status]
        );

        const requestCreate = mapRequest(req_query.rows[0])
        res.status(201).json(requestCreate)
    } catch (error) {
        console.error("Error to register the request", error);
        res.status(500).json({error: "Error internar server"})
    }
});

routerRequest.put("/:id_request", async(req, res) => {
    const idValidate = schemaIdRequest.safeParse(req.params.id_request);
    if(!idValidate.success){
        return res.status(400).json({ error: "id_request not valid" });
    }

    const validation = schemaUpdateRequest.safeParse(req.body);
    if(!validation.success){
        return res.status(400).json({
            error: "data invalid",
            details: validation.error.issues.map((problem) => ({
                field: problem.path.join("."),
                message: problem.message
            }))
        })
    }
   
    const {title, area_request, priority, estimated_cost, status} = validation.data

    try {
        const res_query = await pool.query<RowRequesst>(
            `UPDATE Operational_requests
                SET title = $1,
                    area_request = $2,
                    "priority" = $3,
                    estimated_cost = $4,
                    "status" = $5,
                    update_in = now()
                WHERE id_request = $6
                RETURNING id_request, title, area_request, "priority", estimated_cost, "status", create_in, update_in`,
                [title, area_request, priority, estimated_cost, status, idValidate.data]
        )
        
        if(res_query.rowCount === 0){
            return res.status(404).json({ error: "Request not found" });
        }

        res.status(200).json(mapRequest(res_query.rows[0]));        
    } catch (err) {
        console.error("Error to update request:", err);
        res.status(500).json({ err: "Error internal server" });
    }
})

routerRequest.patch("/:id_request/status", async (req, res) => {
    const idValidate = schemaIdRequest.safeParse(req.params.id_request);
    if (!idValidate.success) {
        return res.status(400).json({ error: "id_request not valid" });
    }

    const validation = schemasStatus.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            error: "data invalid",
            details: validation.error.issues.map((problem) => ({
                field: problem.path.join("."),
                message: problem.message
            }))
        })
    }

    const newStatus = validation.data.status;

    const connection = await pool.connect();

    try {
        await connection.query("BEGIN");

        const query = await connection.query<{ status: string }>(
            `SELECT "status" FROM Operational_requests WHERE id_request = $1 FOR UPDATE`,
            [idValidate.data]
        );

        if (query.rowCount === 0) {
            await connection.query("ROLLBACK");
            return res.status(404).json({ error: "Request not found" });
        }

        const currentStatus = query.rows[0].status;

        if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) {
            await connection.query("ROLLBACK");
            return res.status(409).json({
                error: `Not allowed to go from '${currentStatus}' to '${newStatus}'`,
                valid_transitions: ALLOWED_TRANSITIONS[currentStatus],
            });
        }

        const res_query = await connection.query<RowRequesst>(
            `UPDATE Operational_requests
                SET "status" = $1,
                    update_in = now()
                WHERE id_request = $2
                RETURNING id_request, title, area_request, "priority", estimated_cost, "status", create_in, update_in`,
            [newStatus, idValidate.data]
        );

        await connection.query("COMMIT");
        res.status(200).json(mapRequest(res_query.rows[0]));
    } catch (err) {
        await connection.query("ROLLBACK");
        console.error("Error to update the status:", err);
        res.status(500).json({ error: "Error internal server" });
    } finally {
        connection.release();
    }
});

routerRequest.delete("/:id_request", async(req, res) => {
    const idValidate = schemaIdRequest.safeParse(req.params.id_request);
    if(!idValidate.success){
        return res.status(400).json({ error: "id_request not valid" });
    }

    try {
        const res_query = await pool.query<RowRequesst>(
            `DELETE FROM Operational_requests
                WHERE id_request = $1`,
                [idValidate.data]
        )
        if(res_query.rowCount === 0){
            return res.status(400).json({error: "id not exist"})
        }
        res.status(200).json({message: `id ${req.params.id_request} delete successfully`})
    } catch (err) {
        console.error("Error to delete the request", err);
        res.status(500).json({error: "internal server error"})
    }
})


