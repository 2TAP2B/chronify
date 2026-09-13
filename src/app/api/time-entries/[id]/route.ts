import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  updateTimeEntry,
  deleteTimeEntry,
  TimeEntryError,
  updateTimeEntrySchema,
} from "@/server/services/time-entry";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = updateTimeEntrySchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const entry = await updateTimeEntry({ actor: user, entryId: id, input: input.data });
    return NextResponse.json({ entry });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimeEntryError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await deleteTimeEntry({ actor: user, entryId: id });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimeEntryError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
