import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  listTimeEntries,
  createTimeEntry,
  TimeEntryError,
  createTimeEntrySchema,
} from "@/server/services/time-entry";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const type = url.searchParams.get("type");
    const targetUserId = url.searchParams.get("userId") ?? undefined;

    const entries = await listTimeEntries({
      actor: user,
      targetUserId,
      filter: {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        type: (type ?? undefined) as never,
      },
    });
    return NextResponse.json({ entries });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimeEntryError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = createTimeEntrySchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId") ?? undefined;
    const entry = await createTimeEntry({ actor: user, targetUserId, input: input.data });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimeEntryError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
