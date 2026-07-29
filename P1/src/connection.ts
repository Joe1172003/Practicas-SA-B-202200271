import {Pool} from 'pg'
import "dotenv/config"

const connectionString = process.env.DATABASE_URL
if(!connectionString) {
    throw new Error("Error, database env is empty")
}

export const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000
});

export async function verifyConnection():Promise<void>{
    const res = await pool.query("SELECT NOW() AS time");
    console.log("Conection is ready", res.rows[0].time);
}