import { z } from "zod";
import { Sex } from "../../config/prisma";
import { optionalComorosPhoneSchema } from "../../utils/comoros";


const optionalExternalId = z
  .string()
  .trim()
  .max(50)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const studentSchema = z.object({
  fullName: z.string().min(2),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  sex: z.nativeEnum(Sex).optional(),
  parentName: z.string().optional(),
  parentPhone: optionalComorosPhoneSchema,
  nationalIdNumber: optionalExternalId,
  ministryStudentNumber: optionalExternalId,
  groupeId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const updateStudentSchema = studentSchema.partial();

export type StudentInput = z.infer<typeof studentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
