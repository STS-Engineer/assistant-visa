// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

dotenv.config();

import { pool } from "./db.js";
import { sendSimpleEmail } from "./mail.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" })); // important pour le base64

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

// --- 3) Conversion DOCX -> PDF ---
// Cette route reçoit un DOCX en base64 et renvoie un PDF en base64,
// en utilisant LibreOffice installé sur le serveur.
const LIBREOFFICE_CMD = process.env.LIBREOFFICE_CMD || "libreoffice"; // ou "soffice" selon l'environnement

app.post("/api/convert-docx-to-pdf", (req, res) => {
  const { fileName, docxBase64 } = req.body || {};

  if (!fileName || !docxBase64) {
    return res.status(400).json({
      error: "fileName and docxBase64 are required",
    });
  }

  // Créer un dossier temporaire
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx2pdf-"));

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const docxPath = path.join(tmpDir, safeName);
  const pdfName = safeName.replace(/\.docx$/i, "") + ".pdf";
  const pdfPath = path.join(tmpDir, pdfName);

  try {
    // Écrire le DOCX
    const docxBuffer = Buffer.from(docxBase64, "base64");
    fs.writeFileSync(docxPath, docxBuffer);
  } catch (e) {
    console.error("❌ Erreur écriture DOCX:", e);
    return res.status(500).json({ error: "Cannot write DOCX file" });
  }

  const args = [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    tmpDir,
    docxPath,
  ];

  execFile(LIBREOFFICE_CMD, args, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ Erreur LibreOffice:", err, stderr?.toString());
      return res.status(500).json({
        error: "Conversion failed",
        detail: stderr?.toString(),
      });
    }

    if (!fs.existsSync(pdfPath)) {
      console.error("❌ PDF non généré, chemin attendu:", pdfPath);
      return res.status(500).json({
        error: "PDF not generated",
      });
    }

    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString("base64");

      // Nettoyage (best effort)
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        console.warn("⚠️ Erreur nettoyage tmp:", e);
      }

      return res.json({
        pdfFileName: pdfName,
        pdfBase64,
      });
    } catch (e) {
      console.error("❌ Erreur lecture PDF:", e);
      return res.status(500).json({
        error: "Cannot read generated PDF",
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Assistant VISA sur http://localhost:${PORT}`);
});
