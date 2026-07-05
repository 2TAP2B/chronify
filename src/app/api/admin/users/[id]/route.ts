import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  updateUser,
  toggleUserActive,
  updateUserSchema,
  AdminError,
} from "@/server/services/admin-users";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = updateUserSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json({ error: "Invalid input", issues: input.error.issues }, { status: 400 });
    }
    const updated = await updateUser({ actor: user, userId: id, input: input.data });
    return NextResponse.json({ user: updated });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "activate" && action !== "deactivate") {
      return NextResponse.json({ error: "action must be 'activate' or 'deactivate'" }, { status: 400 });
    }
    const result = await toggleUserActive({ actor: user, userId: id, active: action === "activate" });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
