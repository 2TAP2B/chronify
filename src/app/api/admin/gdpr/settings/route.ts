import { NextResponse } from "next/server";
import { requireUser, getOrgSettings, audit } from "@/server/context";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  retentionYears: z.number().int().min(1).max(10),
  sickNoteRetentionMonths: z.number().int().min(1).max(24),
  auditLogRetentionMonths: z.number().int().min(1).max(24),
  imprintName: z.string().nullable().optional(),
  imprintAddress: z.string().nullable().optional(),
  imprintEmail: z.string().nullable().optional(),
  imprintPhone: z.string().nullable().optional(),
  privacyPolicyUrl: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const settings = await getOrgSettings();
    return NextResponse.json({
      retentionYears: settings.retentionYears,
      sickNoteRetentionMonths: settings.sickNoteRetentionMonths,
      auditLogRetentionMonths: settings.auditLogRetentionMonths,
      imprintName: settings.imprintName,
      imprintAddress: settings.imprintAddress,
      imprintEmail: settings.imprintEmail,
      imprintPhone: settings.imprintPhone,
      privacyPolicyUrl: settings.privacyPolicyUrl,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await db.orgSettings.update({
      where: { id: "singleton" },
      data: {
        retentionYears: parsed.data.retentionYears,
        sickNoteRetentionMonths: parsed.data.sickNoteRetentionMonths,
        auditLogRetentionMonths: parsed.data.auditLogRetentionMonths,
        imprintName: parsed.data.imprintName ?? null,
        imprintAddress: parsed.data.imprintAddress ?? null,
        imprintEmail: parsed.data.imprintEmail ?? null,
        imprintPhone: parsed.data.imprintPhone ?? null,
        privacyPolicyUrl: parsed.data.privacyPolicyUrl ?? null,
      },
    });

    await audit({
      actorId: user.id,
      action: "gdpr.update_settings",
      entity: "OrgSettings",
      payload: parsed.data,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
