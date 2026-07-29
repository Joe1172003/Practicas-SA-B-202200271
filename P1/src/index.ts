import express from "express";
import { pool, verifyConnection } from "./connection";
import { createRequestRouter } from "./requests/request.controller";
import { PgRequestRepository } from "./requests/request.repository.pg";
import { RequestService } from "./requests/request.service";

const app = express();
const port = Number(process.env.PORT || 3000)

app.use(express.json())

app.get("/health", (req, res) => {
    res.status(200).json({status: true})
})


const requestRepository = new PgRequestRepository(pool);
const requestService = new RequestService(requestRepository, requestRepository);

app.use("/api/request", createRequestRouter(requestService));

app.use((_req, res) => {
    res.status(404).json({error: "Route not found"});
})

async function startServer(): Promise<void> {
    await verifyConnection();
    app.listen(port, ()=>{console.log(`app listen in port ${port}`)})
}

startServer().catch((error) => {
    console.error("It can't up server", error);
    process.exit(1)
});
