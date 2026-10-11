import type { PrismaClient } from "../../src/generated/prisma/client";
import { SchoolRole } from "../../src/config/prisma";
import type { SeededSchool } from "./school.seed";
import type { SeededStaff } from "./personnel.seed";
import type { SeededStudent } from "./students.seed";
import { USER_PASSWORD } from "./users.seed";
import { hashPassword } from "../../src/utils/password";

export interface SeededDemoAccounts {
  teacher: {
    id: string;
    email: string;
    staffMemberId: string;
    staffMemberFullName: string;
  };
  parent: {
    id: string;
    email: string;
    fullName: string;
    studentMatricules: string[];
  };
  student: {
    id: string;
    email: string;
    fullName: string;
    studentMatricule: string;
  };
}

const TEACHER_STAFF_SLUG = "toihir-hassane";
const PARENT_FULL_NAME = "Mme YOUSSOUF Aïcha";
const PARENT_STUDENT_MATRICULES = ["EL-0002", "EL-0005"];
const STUDENT_MATRICULE = "EL-0001";

export async function seedDemoAccounts(
  prisma: PrismaClient,
  school: SeededSchool,
  staff: Map<string, SeededStaff>,
  students: Map<string, SeededStudent>,
): Promise<SeededDemoAccounts> {
  const teacherStaff = staff.get(TEACHER_STAFF_SLUG);
  if (!teacherStaff) {
    throw new Error(
      `Fiche Personnel inconnue dans le seed comptes de démo : "${TEACHER_STAFF_SLUG}"`,
    );
  }

  const teacherEmail = "enseignant@ecole-excellence.km";
  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {},
    create: {
      email: teacherEmail,
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: teacherStaff.fullName,
    },
  });


  await prisma.staffMember.update({
    where: { id: teacherStaff.id },
    data: { userId: teacherUser.id },
  });

  await prisma.schoolMembership.upsert({
    where: {
      userId_schoolId_role: {
        userId: teacherUser.id,
        schoolId: school.id,
        role: SchoolRole.ENSEIGNANT,
      },
    },
    update: {},
    create: {
      userId: teacherUser.id,
      schoolId: school.id,
      role: SchoolRole.ENSEIGNANT,
    },
  });

  const parentEmail = "parent@ecole-excellence.km";
  const parentUser = await prisma.user.upsert({
    where: { email: parentEmail },
    update: {},
    create: {
      email: parentEmail,
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: PARENT_FULL_NAME,
    },
  });

  const parentStudents = PARENT_STUDENT_MATRICULES.map((matricule) => {
    const student = students.get(matricule);
    if (!student)
      throw new Error(
        `Élève inconnu dans le seed comptes de démo : "${matricule}"`,
      );
    return student;
  });


  for (const student of parentStudents) {
    await prisma.studentGuardian.upsert({
      where: {
        userId_studentId: { userId: parentUser.id, studentId: student.id },
      },
      update: {},
      create: { userId: parentUser.id, studentId: student.id },
    });
  }

  const studentForAccount = students.get(STUDENT_MATRICULE);
  if (!studentForAccount) {
    throw new Error(
      `Élève inconnu dans le seed comptes de démo : "${STUDENT_MATRICULE}"`,
    );
  }

  const studentEmail = "eleve@ecole-excellence.km";
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      email: studentEmail,
      passwordHash: await hashPassword(USER_PASSWORD),
      fullName: studentForAccount.fullName,
    },
  });


  await prisma.student.update({
    where: { id: studentForAccount.id },
    data: { userId: studentUser.id },
  });

  return {
    teacher: {
      id: teacherUser.id,
      email: teacherUser.email,
      staffMemberId: teacherStaff.id,
      staffMemberFullName: teacherStaff.fullName,
    },
    parent: {
      id: parentUser.id,
      email: parentUser.email,
      fullName: parentUser.fullName,
      studentMatricules: parentStudents.map((s) => s.matricule),
    },
    student: {
      id: studentUser.id,
      email: studentUser.email,
      fullName: studentUser.fullName,
      studentMatricule: studentForAccount.matricule,
    },
  };
}
