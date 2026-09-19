import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import { maskMailConfig, resolveMailConfig, type ResolvedMailConfig } from "@/lib/mail-config";

type CacheEntry = { key: string; transporter: Transporter };

let cached: CacheEntry | null = null;

function configKey(cfg: ResolvedMailConfig): string {
  return [cfg.host, cfg.port, cfg.user, cfg.pass, cfg.tls].join("|");
}

export async function getMailConfig(): Promise<ResolvedMailConfig> {
  const settings = await db.orgSettings.findUniqueOrThrow({
    where: { id: "singleton" },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassword: true,
      smtpFrom: true,
      smtpTls: true,
    },
  });
  return resolveMailConfig(
    {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM: process.env.SMTP_FROM,
      SMTP_TLS: process.env.SMTP_TLS,
    },
    settings
  );
}

function getTransporter(cfg: ResolvedMailConfig) {
  const key = configKey(cfg);
  if (cached && cached.key === key) return cached.transporter;

  if (!cfg.host) throw new Error("SMTP not configured");

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    requireTLS: cfg.tls,
  });
  cached = { key, transporter };
  return transporter;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendMailResult = {
  delivered: boolean;
  skipped: boolean;
  error?: string;
};

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const cfg = await getMailConfig();

  if (!cfg.host) {
    // Mail deactivated: keep a log trail so operators are not surprised when
    // notifications are missing.
    console.log("[mail] SMTP not configured — logging instead of sending:");
    console.log(`[mail]   To: ${input.to}`);
    console.log(`[mail]   Subject: ${input.subject}`);
    console.log(`[mail]   Body: ${input.text ?? input.html.slice(0, 200)}`);
    return { delivered: false, skipped: true };
  }

  try {
    await getTransporter(cfg).sendMail({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { delivered: true, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mail] Failed to send email:", message);
    return { delivered: false, skipped: false, error: message };
  }
}

export function isMailConfigured(cfg: ResolvedMailConfig): boolean {
  return !!cfg.host;
}

export async function getMailStatus() {
  const settings = await db.orgSettings.findUniqueOrThrow({
    where: { id: "singleton" },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassword: true,
      smtpFrom: true,
      smtpTls: true,
    },
  });
  const cfg = resolveMailConfig(
    {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM: process.env.SMTP_FROM,
      SMTP_TLS: process.env.SMTP_TLS,
    },
    settings
  );
  return {
    configured: !!cfg.host,
    masked: maskMailConfig(cfg),
  };
}
