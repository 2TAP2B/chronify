import { z } from "zod";

export const timeEntryTypeSchema = z.enum([
  "WORK",
  "VACATION",
  "SICK",
  "PUBLIC_HOLIDAY",
  "PERSONAL",
]);

export const createTimeEntrySchema = z.object({
  date: z.coerce.date(),
  startAt: z.coerce.date().nullable(),
  endAt: z.coerce.date().nullable(),
  breakMinutes: z.number().int().min(0).max(1440).default(0),
  type: timeEntryTypeSchema.default("WORK"),
  note: z.string().trim().max(500).nullish(),
});

export const updateTimeEntrySchema = z.object({
  date: z.coerce.date().optional(),
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
  breakMinutes: z.number().int().min(0).max(1440).optional(),
  type: timeEntryTypeSchema.optional(),
  note: z.string().trim().max(500).nullish().optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
