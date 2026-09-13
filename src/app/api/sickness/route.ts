import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/context";
import {
  listSickNotes,
  createSickNote,
  SicknessError,
  type SickNoteCreateInput,
} from "@/server/services/sickness";

const createSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  aubUntil: z.coerce.date().nullish(),
  note: z.string().trim().max(500).nullish(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId") ?? undefined;
    const year = url.searchParams.get("year") ? Number(url.searchParams.get("year")) : undefined;
    const { notes } = await listSickNotes({ actor: user, targetUserId, year });
    return NextResponse.json({ notes });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof SicknessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = createSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId") ?? undefined;
    const note = await createSickNote({
      actor: user,
      targetUserId,
      input: input.data as SickNoteCreateInput,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof SicknessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
