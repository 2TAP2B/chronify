import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  listTemplates,
  createTemplate,
  createTemplateSchema,
} from "@/server/services/admin-templates";

export async function GET() {
  const user = await requireUser();
  try {
    const templates = await listTemplates(user);
    return NextResponse.json({ templates });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  try {
    const body = await req.json();
    const input = createTemplateSchema.parse(body);
    const template = await createTemplate({ actor: user, input });
    return NextResponse.json({ template }, { status: 201 });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code;
    return NextResponse.json({ error: (err as Error).message, code }, { status });
  }
}
