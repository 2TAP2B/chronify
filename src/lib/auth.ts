import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        email: { label: "Email", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      authorize: async (credentials, req) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const ip =
          req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          req?.headers?.get("x-real-ip") ??
          "unknown";
        const rl = rateLimit({ key: `login:${ip}:${email.toLowerCase()}`, max: 10, windowMs: 60_000 });
        if (!rl.ok) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.active) return null;

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
      ? [{
          id: "pocket-id",
          name: "Pocket-ID",
          type: "oidc" as const,
          clientId: process.env.OIDC_CLIENT_ID,
          clientSecret: process.env.OIDC_CLIENT_SECRET,
          authorization: {
            url: `${process.env.OIDC_ISSUER}/authorize`,
            params: { scope: "openid profile email" },
          },
          token: `${process.env.OIDC_ISSUER}/api/oidc/token`,
          userinfo: `${process.env.OIDC_ISSUER}/api/oidc/userinfo`,
          jwks_endpoint: `${process.env.OIDC_ISSUER}/.well-known/jwks.json`,
          profile(profile: { email?: string; name?: string; sub?: string }) {
            return {
              id: profile.sub ?? "",
              email: profile.email ?? "",
              name: profile.name ?? profile.email ?? "",
            };
          },
        } satisfies { id: string; name: string; type: "oidc"; clientId: string; clientSecret: string; authorization: { url: string; params: { scope: string } }; token: string; userinfo: string; jwks_endpoint: string; profile: (p: { email?: string; name?: string; sub?: string }) => { id: string; email: string; name: string } }]
      : []),
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider === "pocket-id" && user.email) {
        const dbUser = await db.user.findUnique({
          where: { email: (user.email as string).toLowerCase() },
        });
        if (!dbUser || !dbUser.active) return false;
        if (dbUser.mustChangePassword) return false;
      }
      return true;
    },
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
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