// db.js
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'avo-adb-002.postgres.database.azure.com',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'rh_application',
  user: process.env.DB_USER || 'administrationSTS',
  password: process.env.DB_PASSWORD || 'St$@0987',
  ssl: {rejectUnauthorized: false }
});

export async function testDbConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT NOW() AS now");
    console.log("✅ PostgreSQL OK, heure serveur :", result.rows[0].now);
  } catch (err) {
    console.error("❌ Erreur PostgreSQL :", err);
  } finally {
    client.release();
  }
}
