import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}