import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { isMutationMethod, checkCsrfOrigin } from "@/lib/csrf";

const intlMiddleware = createMiddleware(routing);

const publicRoutes = ["/login", "/kiosk"];

type Session = { user: { id: string; role: "EMPLOYEE" | "ADMIN" } } | null;

const secureCookie = process.env.AUTH_SECURE_COOKIE === "true";

async function getSession(request: NextRequest): Promise<Session> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });
  if (!token?.id || !token?.role) return null;
  return { user: { id: token.id as string, role: token.role as "EMPLOYEE" | "ADMIN" } };
}

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.slice(0, -1);
  return `${proto}://${request.nextUrl.host}`;
}

function redirectUrl(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) url.protocol = `${proto}:`;
  url.pathname = pathname;
  return url;
}

function checkApiCsrf(request: NextRequest): NextResponse | null {
  if (!isMutationMethod(request.method)) return null;
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return null;

  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  const allowed = (process.env.CSRF_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const expected = requestOrigin(request);

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
    return NextResponse.redirect(redirectUrl(request, `/${locale}/dashboard`));
  }

  if (!session && !isPublicRoute) {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    return NextResponse.redirect(redirectUrl(request, `/${locale}/login`));
  }

  if (session && pathname.includes("/admin") && session.user.role !== "ADMIN") {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    return NextResponse.redirect(redirectUrl(request, `/${locale}/dashboard`));
  }

  if (intlResponse) {
    intlResponse.headers.set("x-pathname", pathname);
    return intlResponse;
  }
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-*.js|icons|manifest|kiosk-manifest).*)",
  ],
};
