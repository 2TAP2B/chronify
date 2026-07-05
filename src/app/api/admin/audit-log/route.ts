import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { listAuditLog } from "@/server/services/admin-settings";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const entity = url.searchParams.get("entity") ?? undefined;
    const actorId = url.searchParams.get("actorId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;
    const result = await listAuditLog({ actor: user, entity, actorId, limit, offset });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
