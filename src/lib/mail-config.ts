export type ResolvedMailConfig = {
  host: string | null;
  port: number;
  user: string | null;
  pass: string | null;
  from: string;
  tls: boolean;
  source: "env" | "db" | "none";
};

export type MailConfigInput = {
  env: {
    SMTP_HOST?: string;
    SMTP_PORT?: string;
    SMTP_USER?: string;
    SMTP_PASS?: string;
    SMTP_FROM?: string;
    SMTP_TLS?: string;
  };
  db: {
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpPassword: string | null;
    smtpFrom: string | null;
    smtpTls: boolean | null;
  } | null;
};

/** Env wins when SMTP_HOST is present; otherwise DB settings; none disables mail. */
export function resolveMailConfig(
  env: MailConfigInput["env"],
  db: MailConfigInput["db"]
): ResolvedMailConfig {
  const fromEnv = env.SMTP_HOST?.trim();
  if (fromEnv) {
    return {
      host: fromEnv,
      port: parseInt(env.SMTP_PORT ?? "587", 10),
      user: env.SMTP_USER?.trim() ?? null,
      pass: env.SMTP_PASS?.trim() ?? null,
      from: env.SMTP_FROM?.trim() || "chronify@example.com",
      tls: env.SMTP_TLS !== "false",
      source: "env",
    };
  }
  if (db?.smtpHost?.trim()) {
    return {
      host: db.smtpHost.trim(),
      port: db.smtpPort ?? 587,
      user: db.smtpUser?.trim() ?? null,
      pass: db.smtpPassword?.trim() ?? null,
      from: db.smtpFrom?.trim() || env.SMTP_FROM?.trim() || "chronify@example.com",
      tls: db.smtpTls !== false,
      source: "db",
    };
  }
  return {
    host: null,
    port: 587,
    user: null,
    pass: null,
    from: env.SMTP_FROM?.trim() || "chronify@example.com",
    tls: env.SMTP_TLS !== "false",
    source: "none",
  };
}

/**
 * Masked config for the settings UI: password is never echoed, only whether
 * one exists.
 */
export function maskMailConfig(config: ResolvedMailConfig): {
  host: string | null;
  port: number;
  user: string | null;
  hasPassword: boolean;
  from: string;
  tls: boolean;
  source: ResolvedMailConfig["source"];
} {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    hasPassword: !!config.pass,
    from: config.from,
    tls: config.tls,
    source: config.source,
  };
}
