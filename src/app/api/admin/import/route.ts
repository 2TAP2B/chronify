import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { importTimeEntries, importRowSchema, ImportError } from "@/server/services/import";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body || !body.targetUserId || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const rows = importRowSchema.array().safeParse(body.rows);
    if (!rows.success) {
      return NextResponse.json(
        { error: "Invalid rows", issues: rows.error.issues },
        { status: 400 }
      );
    }

    const result = await importTimeEntries({
      actor: user,
      targetUserId: body.targetUserId,
      rows: rows.data,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
