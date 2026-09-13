import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/context";
import {
  updateSickNote,
  deleteSickNote,
  SicknessError,
  type SickNoteUpdateInput,
} from "@/server/services/sickness";

const updateSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  aubUntil: z.coerce.date().nullish(),
  note: z.string().trim().max(500).nullish(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = updateSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const note = await updateSickNote({
      actor: user,
      noteId: id,
      input: input.data as SickNoteUpdateInput,
    });
    return NextResponse.json({ note });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof SicknessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await deleteSickNote({ actor: user, noteId: id });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof SicknessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
