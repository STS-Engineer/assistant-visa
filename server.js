// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { pool, testDbConnection } from "./db.js";
import { sendSimpleEmail } from "./mail.js";

const app = express();
app.use(cors());
app.use(express.json());

// --- 0) Test API + base de données ---
app.get("/api/health", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() AS now");
    client.release();

    console.log("✅ PostgreSQL OK, heure serveur :", result.rows[0].now);
    res.json({ status: "ok", now: result.rows[0].now });
  } catch (err) {
    console.error("❌ Erreur PostgreSQL :", err);

    res.status(500).json({
      status: "db error",
      message: err.message,
      code: err.code || null,
    });
  }
});


// --- 1) Lire 1 employé par matricule ---
app.get("/api/employees/:matricule", async (req, res) => {
  try {
    const matricule = req.params.matricule;

    // ⚠️ Adapter "matricule" au nom réel de la colonne dans ta base
    const result = await pool.query(
      "SELECT * FROM employees WHERE matricule = $1",
      [matricule]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Employé introuvable" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erreur lecture employé :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- 2) Envoyer un email via Administration STS ---
app.post("/api/emails/send", async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    await sendSimpleEmail({ to, subject, text });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur envoi email :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Assistant VISA sur http://localhost:${PORT}`);
});
