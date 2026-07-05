import { db } from "@/lib/db";
import { audit, type SessionUser } from "@/server/context";
import { z } from "zod";

export class WorkingModelError extends Error {
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
    throw new WorkingModelError("Forbidden", "FORBIDDEN", 403);
  }
}

export const createWorkingModelSchema = z.object({
  userId: z.string(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().nullish(),
  mondayMinutes: z.number().int().min(0).max(1440).default(0),
  tuesdayMinutes: z.number().int().min(0).max(1440).default(0),
  wednesdayMinutes: z.number().int().min(0).max(1440).default(0),
  thursdayMinutes: z.number().int().min(0).max(1440).default(0),
  fridayMinutes: z.number().int().min(0).max(1440).default(0),
  saturdayMinutes: z.number().int().min(0).max(1440).default(0),
  sundayMinutes: z.number().int().min(0).max(1440).default(0),
  weeklyTargetMinutes: z.number().int().min(0).max(10080).default(0),
  autoBreakThreshold6h: z.boolean().default(true),
  autoBreakMinutes6h: z.number().int().min(0).max(480).default(30),
  autoBreakThreshold9h: z.boolean().default(true),
  autoBreakMinutes9h: z.number().int().min(0).max(480).default(45),
});

export const updateWorkingModelSchema = createWorkingModelSchema.partial().omit({ userId: true });

export type CreateWorkingModelInput = z.infer<typeof createWorkingModelSchema>;
export type UpdateWorkingModelInput = z.infer<typeof updateWorkingModelSchema>;

export async function listForUser(actor: SessionUser, userId: string) {
  requireAdmin(actor);
  return db.workingModel.findMany({
    where: { userId },
    orderBy: { validFrom: "desc" },
  });
}

export async function createModel(opts: {
  actor: SessionUser;
  input: CreateWorkingModelInput;
}) {
  requireAdmin(opts.actor);
  // If validTo is set, ensure validFrom < validTo
  if (opts.input.validTo && opts.input.validFrom.getTime() >= opts.input.validTo.getTime()) {
    throw new WorkingModelError("validFrom must be before validTo", "INVALID_RANGE");
  }
  const model = await db.workingModel.create({ data: opts.input as never });
  await audit({
    actorId: opts.actor.id,
    targetId: opts.input.userId,
    action: "working_model.create",
    entity: "WorkingModel",
    entityId: model.id,
    payload: { validFrom: opts.input.validFrom.toISOString() },
  });
  return model;
}

export async function updateModel(opts: {
  actor: SessionUser;
  modelId: string;
  input: UpdateWorkingModelInput;
}) {
  requireAdmin(opts.actor);
  const existing = await db.workingModel.findUnique({ where: { id: opts.modelId } });
  if (!existing) throw new WorkingModelError("Not found", "NOT_FOUND", 404);

  if (opts.input.validFrom !== undefined || opts.input.validTo !== undefined) {
    const from = opts.input.validFrom ?? existing.validFrom;
    const to = opts.input.validTo ?? existing.validTo;
    if (to && from.getTime() >= to.getTime()) {
      throw new WorkingModelError("validFrom must be before validTo", "INVALID_RANGE");
    }
  }

  const updated = await db.workingModel.update({
    where: { id: opts.modelId },
    data: opts.input as never,
  });
  await audit({
    actorId: opts.actor.id,
    targetId: existing.userId,
    action: "working_model.update",
    entity: "WorkingModel",
    entityId: opts.modelId,
    payload: { changes: Object.keys(opts.input) },
  });
  return updated;
}

export async function deleteModel(opts: { actor: SessionUser; modelId: string }) {
  requireAdmin(opts.actor);
  const existing = await db.workingModel.findUnique({ where: { id: opts.modelId } });
  if (!existing) throw new WorkingModelError("Not found", "NOT_FOUND", 404);
  await db.workingModel.delete({ where: { id: opts.modelId } });
  await audit({
    actorId: opts.actor.id,
    targetId: existing.userId,
    action: "working_model.delete",
    entity: "WorkingModel",
    entityId: opts.modelId,
  });
  return { id: opts.modelId };
}
