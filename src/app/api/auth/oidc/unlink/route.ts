import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await db.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: "pocket-id",
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}