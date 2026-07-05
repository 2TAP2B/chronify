import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/context";
import {
  listVacationRequests,
  createVacationRequest,
  getVacationEntitlementView,
  VacationError,
} from "@/server/services/vacation";

const createSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  note: z.string().trim().max(500).nullish(),
  year: z.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId") ?? undefined;
    const year = url.searchParams.get("year") ? Number(url.searchParams.get("year")) : undefined;
    const status = url.searchParams.get("status") ?? undefined;

    const { requests } = await listVacationRequests({
      actor: user,
      targetUserId,
      year,
      status: status as never,
    });
    const entitlement = await getVacationEntitlementView({ actor: user, targetUserId, year });
    return NextResponse.json({ requests, entitlement });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof VacationError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = createSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const created = await createVacationRequest({ actor: user, input: input.data });
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof VacationError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
