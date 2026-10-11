import { z } from "zod";
import { AttendanceStatus } from "../../config/prisma";


export const attendanceSchema = z.object({
  studentId: z.string().uuid(),
  date: z.string().min(1, "La date est requise."),
  status: z.nativeEnum(AttendanceStatus),
  subject: z.string().trim().min(1).optional(),
  heure: z.string().trim().min(1).optional(),
  motif: z.string().trim().min(1).optional(),
  justifiee: z.boolean().optional(),
});

export const updateAttendanceSchema = z.object({
  status: z.nativeEnum(AttendanceStatus).optional(),
  subject: z.string().trim().min(1).nullable().optional(),
  heure: z.string().trim().min(1).nullable().optional(),
  motif: z.string().trim().min(1).nullable().optional(),
  justifiee: z.boolean().nullable().optional(),
});


export const bulkAttendanceSchema = z.object({
  groupeId: z.string().uuid(),
  date: z.string().min(1, "La date est requise."),
  records: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.nativeEnum(AttendanceStatus),
      heure: z.string().trim().min(1).optional(),
      motif: z.string().trim().min(1).optional(),
      justifiee: z.boolean().optional(),
    })
  ),
});

export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
