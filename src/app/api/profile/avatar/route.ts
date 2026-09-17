import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { setOwnAvatar } from "@/server/services/profile";

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => null)) as { dataUrl?: unknown } | null;
    let dataUrl: string | null = null;
    if (body !== null && body !== undefined) {
      if (typeof body.dataUrl !== "string" && body.dataUrl !== null) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }
      dataUrl = body.dataUrl ?? null;
    }
    const profile = await setOwnAvatar({ actor: user, dataUrl });
    return NextResponse.json({ profile });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
