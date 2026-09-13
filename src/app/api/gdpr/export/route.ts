import { NextResponse } from "next/server";
import { requireUser, audit } from "@/server/context";
import { exportUserData } from "@/server/services/gdpr-export";

export async function GET() {
  try {
    const user = await requireUser();
    const data = await exportUserData(user);

    await audit({
      actorId: user.id,
      targetId: user.id,
      action: "gdpr.export",
      entity: "User",
      entityId: user.id,
    });

    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="chronify-dsgvo-export-${date}.json"`,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
