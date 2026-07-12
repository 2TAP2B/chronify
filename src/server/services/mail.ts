import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const tls = process.env.SMTP_TLS !== "false";

  if (!host) {
    throw new Error("SMTP_HOST not configured");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
    requireTLS: tls,
  });

  return transporter;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(input: SendMailInput): Promise<void> {
  const from = process.env.SMTP_FROM ?? "puku-timetracking@example.com";

  if (!process.env.SMTP_HOST) {
    console.log("[mail] SMTP not configured — logging instead of sending:");
    console.log(`[mail]   To: ${input.to}`);
    console.log(`[mail]   Subject: ${input.subject}`);
    console.log(`[mail]   Body: ${input.text ?? input.html.slice(0, 200)}`);
    return;
  }

  try {
    await getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (err) {
    console.error("[mail] Failed to send email:", err);
  }
}

export function isMailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}