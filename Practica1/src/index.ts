import express from "express";
import { verifyConnection } from "./connection";
import { routerRequest } from "./solicitudes";

const app = express();
const port = Number(process.env.PORT || 3000)

app.get("/health", (req, res) => {
    res.status(200).json({status: true})
})


app.use(express.json())

app.use("/api/request", routerRequest);

app.use((req, res) => {
    res.status(404).json({error: "Rout not found"});
})

async function startServer(): Promise<void> {
    await verifyConnection();
    app.listen(port, ()=>{console.log(`app listen in port ${port}`)})
}

startServer().catch((error) => {
    console.error("It can't up server", error);
    process.exit(1)
});


