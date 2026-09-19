import { describe, it, expect } from "vitest";
import { resolveMailConfig, maskMailConfig } from "./mail-config";

describe("resolveMailConfig", () => {
  it("prefers env when SMTP_HOST is set", () => {
    const cfg = resolveMailConfig(
      {
        SMTP_HOST: "env.example.com",
        SMTP_PORT: "465",
        SMTP_USER: "u",
        SMTP_PASS: "p",
        SMTP_FROM: "from@x.y",
        SMTP_TLS: "false",
      },
      {
        smtpHost: "db.example.com",
        smtpPort: 25,
        smtpUser: null,
        smtpPassword: null,
        smtpFrom: null,
        smtpTls: true,
      }
    );
    expect(cfg).toMatchObject({
      host: "env.example.com",
      source: "env",
      port: 465,
      tls: false,
      from: "from@x.y",
    });
  });

  it("falls back to DB settings without env", () => {
    const cfg = resolveMailConfig(
      {},
      {
        smtpHost: "db.example.com",
        smtpPort: 5870,
        smtpUser: "dbu",
        smtpPassword: "dbp",
        smtpFrom: "db@x.y",
        smtpTls: true,
      }
    );
    expect(cfg).toMatchObject({
      host: "db.example.com",
      port: 5870,
      source: "db",
      user: "dbu",
      pass: "dbp",
    });
  });

  it("source none when neither is configured", () => {
    const cfg = resolveMailConfig({}, null);
    expect(cfg.host).toBeNull();
    expect(cfg.source).toBe("none");
  });

  it("blank db host counts as unconfigured", () => {
    const cfg = resolveMailConfig(
      {},
      {
        smtpHost: "   ",
        smtpPort: null,
        smtpUser: null,
        smtpPassword: null,
        smtpFrom: null,
        smtpTls: null,
      }
    );
    expect(cfg.source).toBe("none");
  });

  it("db settings apply when env has only SMTP_FROM", () => {
    const cfg = resolveMailConfig(
      { SMTP_FROM: "from@x.y" },
      {
        smtpHost: "db.example.com",
        smtpPort: null,
        smtpUser: null,
        smtpPassword: null,
        smtpFrom: null,
        smtpTls: null,
      }
    );
    expect(cfg.source).toBe("db");
    expect(cfg.from).toBe("from@x.y");
  });
});

describe("maskMailConfig", () => {
  it("never exposes the password", () => {
    const masked = maskMailConfig(resolveMailConfig({ SMTP_HOST: "h", SMTP_PASS: "secret" }, null));
    expect(masked.hasPassword).toBe(true);
    expect(JSON.stringify(masked)).not.toContain('h";​');
    expect("pass" in masked).toBe(false);
  });
});
