import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  listClosures,
  createClosure,
  createClosureSchema,
  ClosureError,
} from "@/server/services/business-closures";

export async function GET() {
  const user = await requireUser();
  try {
    const closures = await listClosures(user);
    return NextResponse.json({ closures });
  } catch (e) {
    if (e instanceof ClosureError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  try {
    const body = await req.json();
    const input = createClosureSchema.parse(body);
    const closure = await createClosure({ actor: user, input });
    return NextResponse.json({ closure }, { status: 201 });
  } catch (e) {
    if (e instanceof ClosureError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}
