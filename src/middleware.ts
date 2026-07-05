import createMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const publicRoutes = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let next-intl handle locale prefixing first
  const intlResponse = intlMiddleware(request);

  const session = await auth();

  const isAuthRoute = pathname.includes("/login");
  const isPublicRoute = publicRoutes.some((r) => pathname.endsWith(r));

  if (isAuthRoute && session) {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  if (!session && !isPublicRoute) {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  if (session && pathname.includes("/admin") && session.user.role !== "ADMIN") {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|workbox-*.js|icons|manifest).*)"],
};
