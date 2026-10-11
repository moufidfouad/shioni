import type { PrismaClient } from "../../src/generated/prisma/client";
import { SchoolRole } from "../../src/config/prisma";
import { DEFAULT_CURRENCY } from "../../src/utils/comoros";
import { hashPassword } from "../../src/utils/password";
import type { SeededUsers } from "./users.seed";

// Id fixe pour l'école de démo (pas un `seedId()` dérivé : c'est la même
// convention qu'avant cette restructuration, conservée pour ne pas changer
// l'id d'une école déjà seedée sur une base existante).
export const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

export interface SeededSchool {
  id: string;
  currency: string;

  schoolYearId: string;
  schoolYearLabel: string;

  directorUserId: string;
}

export async function seedSchool(
  prisma: PrismaClient,
  users: SeededUsers,
): Promise<SeededSchool> {
  const school = await prisma.school.upsert({
    where: { id: DEMO_SCHOOL_ID },
    update: {},
    create: {
      id: DEMO_SCHOOL_ID,
      name: "ÉCOLE EXCELLENCE",
      director: "M. ABDOU Saïd",
      address: "Moroni, Volo-Volo",
      island: "Ngazidja",
      phone: "+269 773 00 00",
      email: "contact@ecole-excellence.km",
      arreteNumber: "ARR-MEN-2025-014",
      currency: DEFAULT_CURRENCY,
      cycle: "Secondaire général",
      createdById: users.director.id,
    },
  });

  const memberships: [string, (typeof SchoolRole)[keyof typeof SchoolRole]][] =
    [
      [users.director.id, SchoolRole.ADMIN],
      [users.secretaire.id, SchoolRole.GESTION_ELEVES],
      [users.responsableNotes.id, SchoolRole.GESTION_NOTES],
      [users.comptable.id, SchoolRole.GESTION_FINANCES],
    ];

  for (const [userId, role] of memberships) {
    await prisma.schoolMembership.upsert({
      where: { userId_schoolId_role: { userId, schoolId: school.id, role } },
      update: {},
      create: { userId, schoolId: school.id, role },
    });
  }

  const schoolYear = await prisma.schoolYear.upsert({
    where: { schoolId_label: { schoolId: school.id, label: "2024-2025" } },
    update: {},
    create: { schoolId: school.id, label: "2024-2025", order: 0 },
  });
  if (school.currentSchoolYearId !== schoolYear.id) {
    await prisma.school.update({
      where: { id: school.id },
      data: { currentSchoolYearId: schoolYear.id },
    });
  }

  return {
    id: school.id,
    currency: school.currency,
    schoolYearId: schoolYear.id,
    schoolYearLabel: schoolYear.label,
    directorUserId: users.director.id,
  };
}

export interface AdditionalSchoolDef {
  id: string; // id fixe, jamais un seedId() dérivé — même raison que DEMO_SCHOOL_ID
  name: string;
  director: { fullName: string; email: string; password: string };
  address: string;
  island: string; // voir utils/comoros.ts::COMOROS_ISLANDS — valeur validée
  phone: string;
  email: string;
  arreteNumber: string;
  cycle: string; // étiquette libre de l'établissement, ex "Collège"
  schoolYearLabel: string;
}

export async function seedAdditionalSchool(
  prisma: PrismaClient,
  def: AdditionalSchoolDef,
): Promise<SeededSchool> {
  // Le compte Directeur de CETTE école sert de `createdById` (School.createdById
  // est requis) — cohérent avec `seedSchool` ci-dessus, où le directeur
  // d'ÉCOLE EXCELLENCE joue le même rôle.
  const director = await prisma.user.upsert({
    where: { email: def.director.email },
    update: {},
    create: {
      email: def.director.email,
      passwordHash: await hashPassword(def.director.password),
      fullName: def.director.fullName,
    },
  });

  const school = await prisma.school.upsert({
    where: { id: def.id },
    update: {},
    create: {
      id: def.id,
      name: def.name,
      director: def.director.fullName,
      address: def.address,
      island: def.island,
      phone: def.phone,
      email: def.email,
      arreteNumber: def.arreteNumber,
      currency: DEFAULT_CURRENCY,
      cycle: def.cycle,
      createdById: director.id,
    },
  });

  await prisma.schoolMembership.upsert({
    where: {
      userId_schoolId_role: {
        userId: director.id,
        schoolId: school.id,
        role: SchoolRole.ADMIN,
      },
    },
    update: {},
    create: {
      userId: director.id,
      schoolId: school.id,
      role: SchoolRole.ADMIN,
    },
  });

  const schoolYear = await prisma.schoolYear.upsert({
    where: {
      schoolId_label: { schoolId: school.id, label: def.schoolYearLabel },
    },
    update: {},
    create: { schoolId: school.id, label: def.schoolYearLabel, order: 0 },
  });
  if (school.currentSchoolYearId !== schoolYear.id) {
    await prisma.school.update({
      where: { id: school.id },
      data: { currentSchoolYearId: schoolYear.id },
    });
  }

  return {
    id: school.id,
    currency: school.currency,
    schoolYearId: schoolYear.id,
    schoolYearLabel: schoolYear.label,
    directorUserId: director.id,
  };
}
