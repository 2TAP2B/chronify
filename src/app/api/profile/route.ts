import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getOwnProfile, updateOwnProfile } from "@/server/services/profile";
import { updateOwnProfileSchema } from "@/lib/validations/profile";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getOwnProfile(user.id);
    return NextResponse.json({ profile });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = updateOwnProfileSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const profile = await updateOwnProfile({ actor: user, input: input.data });
    return NextResponse.json({ profile });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
