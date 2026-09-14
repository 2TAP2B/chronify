import { z } from "zod";

export const updateOwnProfileSchema = z
  .object({
    firstName: z.string().max(50).nullish(),
    lastName: z.string().max(50).nullish(),
  })
  .refine((v) => (v.firstName?.trim() ?? "") !== "" || (v.lastName?.trim() ?? "") !== "", {
    message: "At least one name must be non-empty",
  });
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
