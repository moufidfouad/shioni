import { z } from "zod";
import { SchoolRole } from "../../config/prisma";
import { optionalComorosPhoneSchema } from "../../utils/comoros";

// Au moins un rôle requis pour ajouter un membre (sinon autant ne pas
// l'ajouter). Pour la mise à jour, un tableau vide est autorisé : c'est ce
// qui retire l'utilisateur de l'école (voir members.service.ts).
export const rolesSchema = z.array(z.nativeEnum(SchoolRole)).min(1);
export const updateRolesSchema = z.array(z.nativeEnum(SchoolRole));

export const addMemberSchema = z.object({
  email: z.string().email(),
  roles: rolesSchema,
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

// Itération 27 — création ASSISTÉE (par un ADMIN) d'un compte Enseignant ou
// Parent, contrairement à `addMember` ci-dessus qui suppose un compte déjà
// existant. Même choix "pas de flux email" qu'à l'itération 20 : le mot de
// passe temporaire généré est communiqué de vive voix/par SMS par l'ADMIN,
// jamais envoyé automatiquement.
export const createTeacherAccountSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  phone: optionalComorosPhoneSchema,
  staffMemberId: z.string().min(1),
});
export type CreateTeacherAccountInput = z.infer<typeof createTeacherAccountSchema>;

export const createParentAccountSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  phone: optionalComorosPhoneSchema,
  // Un parent peut avoir plusieurs enfants scolarisés dans la même école
  // (fratrie) — voir StudentGuardian dans schema.prisma.
  studentIds: z.array(z.string().min(1)).min(1),
});
export type CreateParentAccountInput = z.infer<typeof createParentAccountSchema>;

// Itération 31 — compte Élève : un seul `studentId` (pas un tableau comme
// pour le Parent) puisqu'un compte Élève n'est jamais lié qu'à UN SEUL
// élève (voir Student.userId, FK 1-1, dans schema.prisma).
export const createStudentAccountSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  phone: optionalComorosPhoneSchema,
  studentId: z.string().min(1),
});
export type CreateStudentAccountInput = z.infer<typeof createStudentAccountSchema>;
