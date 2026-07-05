import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { listUserChoices, ClosureError } from "@/server/services/business-closures";

export async function GET() {
  const user = await requireUser();
  try {
    const choices = await listUserChoices(user);
    return NextResponse.json({ choices });
  } catch (e) {
    if (e instanceof ClosureError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
