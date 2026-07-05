import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserActive,
  createUserSchema,
  updateUserSchema,
  AdminError,
} from "@/server/services/admin-users";

export async function GET() {
  try {
    const user = await requireUser();
    const users = await listUsers(user);
    return NextResponse.json({ users });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = createUserSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json({ error: "Invalid input", issues: input.error.issues }, { status: 400 });
    }
    const created = await createUser({ actor: user, input: input.data });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
