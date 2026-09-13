import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getRetentionStats, runRetentionCleanup } from "@/server/services/gdpr-cleanup";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const stats = await getRetentionStats();
    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const result = await runRetentionCleanup(user, { dryRun });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
