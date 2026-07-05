import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { isMutationMethod, checkCsrfOrigin } from "@/lib/csrf";

const intlMiddleware = createMiddleware(routing);

const publicRoutes = ["/login"];

type Session = { user: { id: string; role: "EMPLOYEE" | "ADMIN" } } | null;

async function getSession(request: NextRequest): Promise<Session> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.id || !token?.role) return null;
  return { user: { id: token.id as string, role: token.role as "EMPLOYEE" | "ADMIN" } };
}

function checkApiCsrf(request: NextRequest): NextResponse | null {
  if (!isMutationMethod(request.method)) return null;
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return null;

  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  const allowed = (process.env.CSRF_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const expected = host ? `${proto}://${host}` : null;

  const result = checkCsrfOrigin(origin, allowed, expected);
  if (!result.ok) {
    return NextResponse.json(
      { error: "csrf_check_failed", reason: result.reason },
      { status: 403 }
    );
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return checkApiCsrf(request) ?? NextResponse.next();
  }

  const intlResponse = intlMiddleware(request);

  const session = await getSession(request);

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-*.js|icons|manifest).*)",
  ],
};
