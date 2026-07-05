import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
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
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "EMPLOYEE" | "ADMIN";
      }
      return session;
    },
  },
});
