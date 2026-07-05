import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  updateTemplate,
  deleteTemplate,
  assignTemplateToUser,
  updateTemplateSchema,
} from "@/server/services/admin-templates";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  try {
    const { id } = await params;
    const body = await req.json();
    const input = updateTemplateSchema.parse(body);
    const template = await updateTemplate({ actor: user, templateId: id, input });
    return NextResponse.json({ template });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code;
    return NextResponse.json({ error: (err as Error).message, code }, { status });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  try {
    const { id } = await params;
    await deleteTemplate({ actor: user, templateId: id });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code;
    return NextResponse.json({ error: (err as Error).message, code }, { status });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, userId } = body as { action?: string; userId?: string };
    if (action === "assign" && userId) {
      const model = await assignTemplateToUser({ actor: user, templateId: id, userId });
      return NextResponse.json({ model }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code;
    return NextResponse.json({ error: (err as Error).message, code }, { status });
  }
}
