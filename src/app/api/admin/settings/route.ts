import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getSettings, updateSettings, updateSettingsSchema } from "@/server/services/admin-settings";

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getSettings(user);
    return NextResponse.json({ settings });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = updateSettingsSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json({ error: "Invalid input", issues: input.error.issues }, { status: 400 });
    }
    const updated = await updateSettings({ actor: user, input: input.data });
    return NextResponse.json({ settings: updated });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
