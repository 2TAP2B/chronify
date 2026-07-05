import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { deleteClosure, ClosureError } from "@/server/services/business-closures";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  try {
    const { id } = await params;
    await deleteClosure({ actor: user, closureId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ClosureError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
