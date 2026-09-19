import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.AUTH_DEBUG === "true",
  trustHost: true,
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email oder Benutzername", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      authorize: async (credentials, req) => {
        const identifier = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!identifier || !password) return null;

        // Org-level gate: when the admin disables password login, only
        // SSO/OIDC sign-ins are accepted.
        const settings = await db.orgSettings.findUniqueOrThrow({
          where: { id: "singleton" },
          select: { passwordLoginDisabled: true },
        });
        if (settings.passwordLoginDisabled) return null;

        const lookupKey = identifier.toLowerCase().trim();

        const ip =
          req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          req?.headers?.get("x-real-ip") ??
          "unknown";
        const rl = rateLimit({ key: `login:${ip}:${lookupKey}`, max: 10, windowMs: 60_000 });
        if (!rl.ok) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: lookupKey },
              { name: lookupKey },
              { firstName: lookupKey },
              { lastName: lookupKey },
            ],
            active: true,
          },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    ...(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET
      ? [
          {
            id: "pocket-id",
            name: "Pocket-ID",
            type: "oidc" as const,
            issuer: process.env.OIDC_ISSUER,
            clientId: process.env.OIDC_CLIENT_ID,
            clientSecret: process.env.OIDC_CLIENT_SECRET,
            authorization: {
              url: `${process.env.OIDC_ISSUER}/authorize`,
              params: { scope: "openid profile email" },
            },
            token: `${process.env.OIDC_ISSUER}/api/oidc/token`,
            userinfo: `${process.env.OIDC_ISSUER}/api/oidc/userinfo`,
            profile(profile: { email?: string; name?: string; sub?: string }) {
              return {
                // `id` is the OIDC `sub`; the signIn callback replaces it with
                // the local DB user id before the JWT is created.
                id: profile.sub ?? "",
                // Normalized so the PrismaAdapter links accounts to the same
                // row the signIn callback resolves.
                email: (profile.email ?? "").toLowerCase(),
                name: profile.name ?? profile.email ?? "",
              };
            },
            allowDangerousEmailAccountLinking: true,
            checks: ["pkce", "state"] as ("pkce" | "state")[],
          },
        ]
      : []),
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider === "pocket-id") {
        // Never fall through to the raw OIDC `sub` as identity: without a
        // verified email match against a local user, sign-in must fail.
        if (!user.email) return false;
        const dbUser = await db.user.findUnique({
          where: { email: (user.email as string).toLowerCase() },
        });
        if (!dbUser || !dbUser.active) return false;
        if (dbUser.mustChangePassword) return false;

        // Use the local DB identity for the session, not the OIDC provider's
        // `sub` — all services resolve data by DB user id and role.
        user.id = dbUser.id;
        user.role = dbUser.role;
        user.mustChangePassword = dbUser.mustChangePassword;

        await db.user.update({
          where: { id: dbUser.id },
          data: { lastLoginAt: new Date() },
        });
      }
      return true;
    },
    jwt: ({ token, user }) => {
      if (user) {
        // For OIDC sign-ins `user.id`/`user.role` were overridden with the
        // local DB values in the signIn callback; for credentials logins the
        // authorize() return value already carries the DB identity.
        token.id = user.id as string;
        token.role = user.role;
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "EMPLOYEE" | "ADMIN";
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
});
