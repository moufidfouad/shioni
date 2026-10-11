import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedUsers, USER_PASSWORD } from "./seeds/users.seed";
import { seedSchool } from "./seeds/school.seed";
import { seedStructure } from "./seeds/structure.seed";
import { seedParameters } from "./seeds/parameters.seed";
import { seedStudents } from "./seeds/students.seed";
import { seedPersonnel } from "./seeds/personnel.seed";
import { seedSubjects } from "./seeds/subjects.seed";
import { seedEnrollments } from "./seeds/enrollments.seed";
import { seedTuitionFees } from "./seeds/tuitionFees.seed";
import { seedGrades } from "./seeds/grades.seed";
import { seedAttendance } from "./seeds/attendance.seed";
import { seedTimetable } from "./seeds/timetable.seed";
import { seedFinances } from "./seeds/finances.seed";
import { seedDemoAccounts } from "./seeds/accounts.seed";
import { seedAdditionalSchools } from "./seeds/additionalSchools.seed";
import {
  seedResources,
  type ResourceSchoolContext,
} from "./seeds/resources.seed";
import { seedTestimonials } from "./seeds/testimonials.seed";

// Comme dans src/config/prisma.ts : les adapters de connexion sont
// obligatoires depuis Prisma 7, y compris pour un script de seed.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await seedUsers(prisma);
  const school = await seedSchool(prisma, users);
  const { classeIdByName, groupes, salles } = await seedStructure(
    prisma,
    school,
  );
  const feeLevelAmounts = await seedParameters(prisma, school, classeIdByName);
  const students = await seedStudents(prisma, school, groupes);
  const staff = await seedPersonnel(prisma, school);
  const subjects = await seedSubjects(prisma, school, groupes, staff);
  await seedEnrollments(prisma, school, feeLevelAmounts, students);
  await seedTuitionFees(prisma, school, feeLevelAmounts, students);
  await seedGrades(prisma, students, subjects);
  await seedAttendance(prisma, students);
  await seedTimetable(prisma, school, groupes, staff, salles);
  await seedFinances(prisma, school);

  const demoAccounts = await seedDemoAccounts(prisma, school, staff, students);

  const additionalSchools = await seedAdditionalSchools(prisma);

  const resourceContexts: ResourceSchoolContext[] = [
    {
      school,
      publishedByUserId: school.directorUserId,
      subjects,
      classeIdByName,
    },
    ...additionalSchools.map(
      (s): ResourceSchoolContext => ({
        school: s.school,
        publishedByUserId: s.school.directorUserId,
        subjects: s.subjects,
        classeIdByName: s.classeIdByName,
      }),
    ),
  ];
  const resourcesCount = await seedResources(prisma, resourceContexts);

  const testimonialsCount = await seedTestimonials(prisma);

  console.log(
    "✅ Seed terminé (idempotent — peut être relancé sans dupliquer de données).",
  );
  console.log("");
  console.log("   Comptes de démo :");
  console.log(
    `   • Superadmin (toutes écoles)         : ${users.superAdmin.email}`,
  );
  console.log(
    `   • Directeur (ADMIN)                  : ${users.director.email} / ${USER_PASSWORD}`,
  );
  console.log(
    `   • Secrétariat (GESTION_ELEVES)       : ${users.secretaire.email} / ${USER_PASSWORD}`,
  );
  console.log(
    `   • Censorat (GESTION_NOTES)           : ${users.responsableNotes.email} / ${USER_PASSWORD}`,
  );
  console.log(
    `   • Comptabilité (GESTION_FINANCES)    : ${users.comptable.email} / ${USER_PASSWORD}`,
  );
  console.log(
    `   • Enseignant (ENSEIGNANT, scopé sur ${demoAccounts.teacher.staffMemberFullName}) : ${demoAccounts.teacher.email} / ${USER_PASSWORD}`,
  );
  console.log(
    `   • Parent (${demoAccounts.parent.studentMatricules.length} enfant(s) : ${demoAccounts.parent.studentMatricules.join(", ")}) : ${demoAccounts.parent.email} / ${USER_PASSWORD}`,
  );
  console.log(
    `   • Élève (${demoAccounts.student.studentMatricule}) : ${demoAccounts.student.email} / ${USER_PASSWORD}`,
  );
  console.log("");
  console.log(`   Écoles supplémentaires (${additionalSchools.length}) :`);
  for (const s of additionalSchools) {
    console.log(
      `   • ${s.name} — Directeur (ADMIN) : ${s.directorEmail} / ${USER_PASSWORD}`,
    );
  }
  console.log("");
  console.log(
    `   Ressources partagées (démo, toutes écoles confondues) : ${resourcesCount}`,
  );
  console.log(`   Témoignages (landing page) : ${testimonialsCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
