import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  updateUser,
  toggleUserActive,
  deleteUser,
  adjustVacationEntitlement,
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
    if (action === "activate" || action === "deactivate") {
      const result = await toggleUserActive({ actor: user, userId: id, active: action === "activate" });
      return NextResponse.json(result);
    }
    if (action === "adjust-entitlement") {
      const { year, totalDays } = body as { year: number; totalDays: number };
      if (!year || typeof totalDays !== "number") {
        return NextResponse.json({ error: "year and totalDays required" }, { status: 400 });
      }
      await adjustVacationEntitlement({ actor: user, userId: id, year, totalDays });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteUser({ actor: user, userId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
