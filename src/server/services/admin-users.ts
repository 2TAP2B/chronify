import { db } from "@/lib/db";
import { audit, type SessionUser } from "@/server/context";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role, Locale, FederalState, BreakMode } from "@prisma/client";

export class AdminError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
  }
}

export function requireAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") {
    throw new AdminError("Forbidden", "FORBIDDEN", 403);
  }
}

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["EMPLOYEE", "ADMIN"]).default("EMPLOYEE"),
  locale: z.enum(["de", "en"]).default("de"),
  federalState: z.enum([
    "DE_BW", "DE_BY", "DE_BE", "DE_BB", "DE_HB", "DE_HE", "DE_HH", "DE_ME",
    "DE_MV", "DE_NI", "DE_NW", "DE_RP", "DE_SL", "DE_SN", "DE_ST", "DE_SH", "DE_TH",
  ]).default("DE_NW"),
  timezone: z.string().default("Europe/Berlin"),
  breakMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  active: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(1).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["EMPLOYEE", "ADMIN"]).optional(),
  locale: z.enum(["de", "en"]).optional(),
  federalState: z.enum([
    "DE_BW", "DE_BY", "DE_BE", "DE_BB", "DE_HB", "DE_HE", "DE_HH", "DE_ME",
    "DE_MV", "DE_NI", "DE_NW", "DE_RP", "DE_SL", "DE_SN", "DE_ST", "DE_SH", "DE_TH",
  ]).optional(),
  timezone: z.string().optional(),
  breakMode: z.enum(["AUTO", "MANUAL"]).optional(),
  active: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export async function listUsers(actor: SessionUser) {
  requireAdmin(actor);
  return db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      locale: true,
      federalState: true,
      timezone: true,
      breakMode: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

export async function createUser(opts: {
  actor: SessionUser;
  input: CreateUserInput;
}) {
  requireAdmin(opts.actor);
  const existing = await db.user.findUnique({ where: { email: opts.input.email.toLowerCase() } });
  if (existing) {
    throw new AdminError("Email already in use", "EMAIL_TAKEN", 409);
  }
  const passwordHash = await bcrypt.hash(opts.input.password, 12);
  const user = await db.user.create({
    data: {
      email: opts.input.email.toLowerCase(),
      passwordHash,
      name: opts.input.name,
      firstName: opts.input.firstName,
      lastName: opts.input.lastName,
      role: opts.input.role as Role,
      locale: opts.input.locale as Locale,
      federalState: opts.input.federalState as FederalState,
      timezone: opts.input.timezone,
      breakMode: opts.input.breakMode as BreakMode,
      active: opts.input.active,
    },
    select: { id: true, email: true, name: true },
  });
  await audit({
    actorId: opts.actor.id,
    targetId: user.id,
    action: "user.create",
    entity: "User",
    entityId: user.id,
    payload: { email: user.email, role: opts.input.role },
  });
  return user;
}

export async function updateUser(opts: {
  actor: SessionUser;
  userId: string;
  input: UpdateUserInput;
}) {
  requireAdmin(opts.actor);
  const existing = await db.user.findUnique({ where: { id: opts.userId } });
  if (!existing) throw new AdminError("Not found", "NOT_FOUND", 404);

  const data: Record<string, unknown> = {};
  if (opts.input.email !== undefined) data.email = opts.input.email.toLowerCase();
  if (opts.input.name !== undefined) data.name = opts.input.name;
  if (opts.input.firstName !== undefined) data.firstName = opts.input.firstName;
  if (opts.input.lastName !== undefined) data.lastName = opts.input.lastName;
  if (opts.input.role !== undefined) data.role = opts.input.role;
  if (opts.input.locale !== undefined) data.locale = opts.input.locale;
  if (opts.input.federalState !== undefined) data.federalState = opts.input.federalState;
  if (opts.input.timezone !== undefined) data.timezone = opts.input.timezone;
  if (opts.input.breakMode !== undefined) data.breakMode = opts.input.breakMode;
  if (opts.input.active !== undefined) data.active = opts.input.active;
  if (opts.input.password) {
    data.passwordHash = await bcrypt.hash(opts.input.password, 12);
  }

  const updated = await db.user.update({
    where: { id: opts.userId },
    data: data as never,
    select: { id: true, email: true, name: true, active: true, role: true },
  });

  await audit({
    actorId: opts.actor.id,
    targetId: opts.userId,
    action: "user.update",
    entity: "User",
    entityId: opts.userId,
    payload: { changes: Object.keys(data).filter((k) => k !== "passwordHash") },
  });

  return updated;
}

export async function toggleUserActive(opts: {
  actor: SessionUser;
  userId: string;
  active: boolean;
}) {
  requireAdmin(opts.actor);
  if (opts.userId === opts.actor.id && !opts.active) {
    throw new AdminError("Cannot deactivate yourself", "SELF_DEACTIVATE", 400);
  }
  const updated = await db.user.update({
    where: { id: opts.userId },
    data: { active: opts.active },
    select: { id: true, active: true },
  });
  await audit({
    actorId: opts.actor.id,
    targetId: opts.userId,
    action: opts.active ? "user.activate" : "user.deactivate",
    entity: "User",
    entityId: opts.userId,
  });
  return updated;
}
