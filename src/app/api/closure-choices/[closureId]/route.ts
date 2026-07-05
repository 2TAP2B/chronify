import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/context";
import { updateChoice, ClosureError } from "@/server/services/business-closures";

const schema = z.object({
  choice: z.enum(["VACATION", "OVERTIME"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ closureId: string }> }) {
  const user = await requireUser();
  try {
    const { closureId } = await params;
    const body = await req.json();
    const input = schema.parse(body);
    const updated = await updateChoice({ actor: user, closureId, choice: input.choice });
    return NextResponse.json({ choice: updated });
  } catch (e) {
    if (e instanceof ClosureError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}
