import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVapidPublicKey } from "@/server/services/push";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sub = await db.pushSubscription.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return NextResponse.json({
    publicKey: getVapidPublicKey(),
    subscribed: sub !== null,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  const existing = await db.pushSubscription.findFirst({
    where: { endpoint },
  });
  if (existing) {
    await db.pushSubscription.update({
      where: { id: existing.id },
      data: { p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id },
    });
  } else {
    await db.pushSubscription.create({
      data: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let endpoint: string | undefined;
  try {
    const body = await req.json();
    endpoint = body.endpoint;
  } catch {
    // If no body, delete all subs for the user
  }
  if (endpoint) {
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  } else {
    await db.pushSubscription.deleteMany({ where: { userId: session.user.id } });
  }
  return NextResponse.json({ ok: true });
}
