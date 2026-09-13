import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const settings = await db.orgSettings.findUnique({
    where: { id: "singleton" },
    select: {
      appName: true,
      appLogo: true,
      loginImage: true,
      loginQuote: true,
      loginQuoteAuthor: true,
    },
  });

  if (!settings) {
    return NextResponse.json({
      appName: "Chronify",
      appLogo: null,
      loginImage: null,
      loginQuote: null,
      loginQuoteAuthor: null,
    });
  }

  return NextResponse.json(settings);
}
