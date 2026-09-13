import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/server/services/mail";
import { passwordResetEmail } from "@/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";
import { randomBytes } from "node:crypto";

const APP_NAME = process.env.APP_NAME ?? "Chronify";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const rl = rateLimit({ key: `forgot:${ip}`, max: 5, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await req.json()) as { email?: string };
    const email = body.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ ok: true });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, locale: true, active: true },
    });

    if (user && user.active) {
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await db.verificationToken.deleteMany({
        where: { identifier: `reset:${email}` },
      });

      await db.verificationToken.create({
        data: {
          identifier: `reset:${email}`,
          token,
          expires,
        },
      });

      const resetLink = `${APP_URL}/${user.locale}/reset-password/${token}`;
      const mailContent = passwordResetEmail({
        locale: user.locale,
        appName: APP_NAME,
        recipientName: user.name,
        resetLink,
      });

      await sendMail({
        to: email,
        subject: mailContent.subject,
        html: mailContent.html,
        text: mailContent.text,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
