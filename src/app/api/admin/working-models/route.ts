import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  listForUser,
  createModel,
  createWorkingModelSchema,
  WorkingModelError,
} from "@/server/services/admin-working-models";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const models = await listForUser(user, userId);
    return NextResponse.json({ models });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof WorkingModelError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = createWorkingModelSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const model = await createModel({ actor: user, input: input.data });
    return NextResponse.json({ model }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof WorkingModelError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
