import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";

export class TemplateError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function requireAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") throw new TemplateError("Forbidden", "FORBIDDEN", 403);
}

const DAY_FIELDS = {
  mondayMinutes: z.number().int().min(0).max(1440).default(0),
  tuesdayMinutes: z.number().int().min(0).max(1440).default(0),
  wednesdayMinutes: z.number().int().min(0).max(1440).default(0),
  thursdayMinutes: z.number().int().min(0).max(1440).default(0),
  fridayMinutes: z.number().int().min(0).max(1440).default(0),
  saturdayMinutes: z.number().int().min(0).max(1440).default(0),
  sundayMinutes: z.number().int().min(0).max(1440).default(0),
};

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  ...DAY_FIELDS,
  weeklyTargetMinutes: z.number().int().min(0).max(10080).default(0),
  autoBreakThreshold6h: z.boolean().default(true),
  autoBreakMinutes6h: z.number().int().min(0).max(480).default(30),
  autoBreakThreshold9h: z.boolean().default(true),
  autoBreakMinutes9h: z.number().int().min(0).max(480).default(45),
  isDefault: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export async function listTemplates(actor: SessionUser) {
  requireAdmin(actor);
  return db.workingModelTemplate.findMany({ orderBy: { name: "asc" } });
}

export async function createTemplate({ actor, input }: { actor: SessionUser; input: CreateTemplateInput }) {
  requireAdmin(actor);
  const { isDefault, ...data } = input;

  const existing = await db.workingModelTemplate.findUnique({ where: { name: input.name } });
  if (existing) throw new TemplateError("Name already exists", "NAME_TAKEN", 409);

  if (isDefault) {
    await db.workingModelTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  const created = await db.workingModelTemplate.create({ data: { ...data, isDefault } });
  await audit({
    actorId: actor.id,
    targetId: actor.id,
    action: "working_model_template.create",
    entity: "WorkingModelTemplate",
    entityId: created.id,
    payload: { name: input.name },
  });
  return created;
}

export async function updateTemplate({ actor, templateId, input }: { actor: SessionUser; templateId: string; input: UpdateTemplateInput }) {
  requireAdmin(actor);
  const existing = await db.workingModelTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new TemplateError("Not found", "NOT_FOUND", 404);

  if (input.name && input.name !== existing.name) {
    const conflict = await db.workingModelTemplate.findUnique({ where: { name: input.name } });
    if (conflict) throw new TemplateError("Name already exists", "NAME_TAKEN", 409);
  }

  if (input.isDefault === true) {
    await db.workingModelTemplate.updateMany({
      where: { isDefault: true, id: { not: templateId } },
      data: { isDefault: false },
    });
  }

  const updated = await db.workingModelTemplate.update({
    where: { id: templateId },
    data: input,
  });
  await audit({
    actorId: actor.id,
    targetId: actor.id,
    action: "working_model_template.update",
    entity: "WorkingModelTemplate",
    entityId: templateId,
    payload: { changes: Object.keys(input) },
  });
  return updated;
}

export async function deleteTemplate({ actor, templateId }: { actor: SessionUser; templateId: string }) {
  requireAdmin(actor);
  const existing = await db.workingModelTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new TemplateError("Not found", "NOT_FOUND", 404);

  await db.workingModelTemplate.delete({ where: { id: templateId } });
  await audit({
    actorId: actor.id,
    targetId: actor.id,
    action: "working_model_template.delete",
    entity: "WorkingModelTemplate",
    entityId: templateId,
  });
}

export async function assignTemplateToUser({ actor, templateId, userId }: { actor: SessionUser; templateId: string; userId: string }) {
  requireAdmin(actor);
  const template = await db.workingModelTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new TemplateError("Template not found", "NOT_FOUND", 404);

  const user = await db.user.findUnique({ where: { id: userId }, select: { hireDate: true } });
  if (!user) throw new TemplateError("User not found", "NOT_FOUND", 404);

  const validFrom = user.hireDate ?? new Date();
  await db.workingModel.updateMany({
    where: { userId, validTo: null },
    data: { validTo: validFrom },
  });

  const created = await db.workingModel.create({
    data: {
      userId,
      validFrom,
      validTo: null,
      mondayMinutes: template.mondayMinutes,
      tuesdayMinutes: template.tuesdayMinutes,
      wednesdayMinutes: template.wednesdayMinutes,
      thursdayMinutes: template.thursdayMinutes,
      fridayMinutes: template.fridayMinutes,
      saturdayMinutes: template.saturdayMinutes,
      sundayMinutes: template.sundayMinutes,
      weeklyTargetMinutes: template.weeklyTargetMinutes,
      autoBreakThreshold6h: template.autoBreakThreshold6h,
      autoBreakMinutes6h: template.autoBreakMinutes6h,
      autoBreakThreshold9h: template.autoBreakThreshold9h,
      autoBreakMinutes9h: template.autoBreakMinutes9h,
    },
  });
  await audit({
    actorId: actor.id,
    targetId: userId,
    action: "working_model.assign",
    entity: "WorkingModel",
    entityId: created.id,
    payload: { templateId, templateName: template.name },
  });
  return created;
}
