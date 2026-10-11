import { z } from "zod";
import { optionalComorosPhoneSchema } from "../../utils/comoros";



export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  fullName: z.string().min(2),
  phone: optionalComorosPhoneSchema,
});


export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email, numéro d'élève ou numéro de CIN requis."),
  password: z.string().min(1),
});


export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis."),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
