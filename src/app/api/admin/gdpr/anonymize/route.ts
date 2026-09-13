import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { anonymizeUser } from "@/server/services/gdpr-cleanup";
import { z } from "zod";

const schema = z.object({ userId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await anonymizeUser(user, parsed.data.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message.includes("active")) {
      return NextResponse.json({ error: "Cannot anonymize active user" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
