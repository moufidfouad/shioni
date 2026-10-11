import type { PrismaClient } from "../../src/generated/prisma/client";
import { env } from "../../src/config/env";
import { hashPassword } from "../../src/utils/password";

export interface SeededUsers {
  superAdmin: { id: string; email: string };
  director: { id: string; email: string };
  secretaire: { id: string; email: string };
  responsableNotes: { id: string; email: string };
  comptable: { id: string; email: string };
}
export const USER_PASSWORD = env!.SUPERADMIN_PASSWORD;
export async function seedUsers(prisma: PrismaClient): Promise<SeededUsers> {
  const superAdminEmail = env!.SUPERADMIN_EMAIL;

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: "Super Administrateur",
      isSuperAdmin: true,
    },
  });

  const director = await prisma.user.upsert({
    where: { email: "directeur@ecole-excellence.km" },
    update: {},
    create: {
      email: "directeur@ecole-excellence.km",
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: "M. ABDOU Saïd",
    },
  });

  const secretaire = await prisma.user.upsert({
    where: { email: "secretariat@ecole-excellence.km" },
    update: {},
    create: {
      email: "secretariat@ecole-excellence.km",
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: "Mme MOHAMED Fatima",
    },
  });

  const responsableNotes = await prisma.user.upsert({
    where: { email: "censorat@ecole-excellence.km" },
    update: {},
    create: {
      email: "censorat@ecole-excellence.km",
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: "M. SOILIHI Ibrahim",
    },
  });

  const comptable = await prisma.user.upsert({
    where: { email: "comptabilite@ecole-excellence.km" },
    update: {},
    create: {
      email: "comptabilite@ecole-excellence.km",
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: "Mme BACAR Halima",
    },
  });

  return { superAdmin, director, secretaire, responsableNotes, comptable };
}
