import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const rl = rateLimit({ key: `reset:${ip}`, max: 10, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const body = await req.json() as { token?: string; password?: string };
    const { token, password } = body;

    if (!token || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    const resetToken = await db.verificationToken.findFirst({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    if (resetToken.expires < new Date()) {
      await db.verificationToken.delete({ where: { identifier_token: { identifier: resetToken.identifier, token: resetToken.token } } });
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    const email = resetToken.identifier.replace(/^reset:/, "");
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      db.verificationToken.delete({
        where: { identifier_token: { identifier: resetToken.identifier, token: resetToken.token } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}