import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  updateModel,
  deleteModel,
  updateWorkingModelSchema,
  WorkingModelError,
} from "@/server/services/admin-working-models";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = updateWorkingModelSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const model = await updateModel({ actor: user, modelId: id, input: input.data });
    return NextResponse.json({ model });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof WorkingModelError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await deleteModel({ actor: user, modelId: id });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof WorkingModelError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
