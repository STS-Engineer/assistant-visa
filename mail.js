// mail.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 25);
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME;
const EMAIL_FROM = process.env.EMAIL_FROM;

export const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  tls: {
    rejectUnauthorized: false,
  },
  // auth: { user, pass }  // à ajouter si votre Exchange l'exige
});

export async function sendSimpleEmail({ to, subject, text }) {
  const info = await mailer.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to,
    subject,
    text,
  });

  console.log("📧 Email envoyé :", info.messageId);
}
