import { NextResponse } from "next/server";
import { audit, requireUser } from "@/server/context";
import { getMailConfig, isMailConfigured, sendMail } from "@/server/services/mail";

export async function POST() {
  try {
    const user = await requireUser();
    const cfg = await getMailConfig();
    if (!isMailConfigured(cfg)) {
      return NextResponse.json(
        { error: "smtp_not_configured", message: "SMTP is not configured (env or settings)." },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const result = await sendMail({
      to: user.email ?? "",
      subject: "Chronify SMTP-Test",
      html: `<p>SMTP-Verbindung erfolgreich.</p><p>Server: ${cfg.host}:${cfg.port} (${cfg.source})</p>`,
      text: `SMTP-Test OK — ${cfg.host} (${cfg.source})`,
    });
    await audit({
      actorId: user.id,
      action: "settings.test_smtp",
      entity: "OrgSettings",
      entityId: "singleton",
      payload: {
        delivered: result.delivered,
        skipped: result.skipped,
        error: result.error ?? null,
      },
    });

    if (result.error) {
      return NextResponse.json(
        { error: "smtp_send_failed", message: result.error },
        { status: 502 }
      );
    }
    if (result.skipped) {
      return NextResponse.json({ error: "smtp_not_configured" }, { status: 400 });
    }
    return NextResponse.json({ delivered: true, message: `Test mail sent to ${user.email}` });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
