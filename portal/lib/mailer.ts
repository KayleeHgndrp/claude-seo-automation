/**
 * SMTP mailer (Nodemailer). Sends the reviewed outreach email. Created lazily
 * so the app boots without SMTP configured; the send route surfaces a clear
 * error if a key is missing.
 */

import nodemailer from "nodemailer";
import { requireEnv, optionalEnv } from "./env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port: Number(optionalEnv("SMTP_PORT") ?? "587"),
      secure: (optionalEnv("SMTP_SECURE") ?? "false") === "true",
      auth: {
        user: requireEnv("SMTP_USER"),
        pass: requireEnv("SMTP_PASS"),
      },
    });
  }
  return transporter;
}

export interface SendArgs {
  to: string;
  subject: string;
  body: string;
}

export async function sendOutreachEmail({ to, subject, body }: SendArgs): Promise<{ messageId: string }> {
  const from = requireEnv("SMTP_FROM");
  const info = await getTransporter().sendMail({
    from,
    to,
    subject,
    text: body,
    // Plain-text first; a minimal HTML wrapper preserves line breaks.
    html: `<div style="font-family:Georgia,'Times New Roman',serif;white-space:pre-wrap;line-height:1.5;color:#1e3a5f">${escapeHtml(
      body,
    )}</div>`,
  });
  return { messageId: info.messageId };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
