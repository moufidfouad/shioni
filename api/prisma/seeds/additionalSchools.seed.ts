import type { PrismaClient } from "../../src/generated/prisma/client";
import { Sex, FinanceEntryType } from "../../src/config/prisma";
import {
  seedAdditionalSchool,
  type AdditionalSchoolDef,
  type SeededSchool,
} from "./school.seed";
import { seedStructure, type CycleDef, type SalleDef } from "./structure.seed";
import { seedParameters } from "./parameters.seed";
import { seedStudents, type StudentDef } from "./students.seed";
import { seedPersonnel, type StaffDef } from "./personnel.seed";
import {
  seedSubjects,
  type SubjectDef,
  type SeededSubject,
} from "./subjects.seed";
import { seedEnrollments } from "./enrollments.seed";
import { seedTuitionFees } from "./tuitionFees.seed";
import { seedGrades } from "./grades.seed";
import { seedAttendance } from "./attendance.seed";
import { seedTimetable, type TimetableEntryDef } from "./timetable.seed";
import { seedFinances, type FinanceEntryDef } from "./finances.seed";

export interface SeededAdditionalSchool {
  school: SeededSchool;
  name: string;
  directorEmail: string;

  classeIdByName: Map<string, string>;
  subjects: Map<string, SeededSubject>;
}

// ============================================================================
// École 2 — COLLÈGE AL-CAMAR (Anjouan, Mutsamudu)
// ============================================================================

const COLLEGE_AL_CAMAR_ID = "00000000-0000-0000-0000-000000000002";

const COLLEGE_DEF: AdditionalSchoolDef = {
  id: COLLEGE_AL_CAMAR_ID,
  name: "COLLÈGE AL-CAMAR",
  director: {
    fullName: "Mme CHOUZOUR Fatima",
    email: "directeur@college-al-camar.km",
    password: "Directeur123!",
  },
  address: "Mutsamudu, Anjouan",
  island: "Anjouan",
  phone: "+269 771 20 00",
  email: "contact@college-al-camar.km",
  arreteNumber: "ARR-MEN-2025-027",
  cycle: "Collège",
  schoolYearLabel: "2024-2025",
};

// Un seul cycle (Collège), deux classes SANS série (comme "3ème" chez ÉCOLE
// EXCELLENCE), un groupe chacune — volontairement plus simple que la
// hiérarchie Cycle/Classe/Série/Groupe complète d'ÉCOLE EXCELLENCE, pour
// rester lisible comme second exemple.
const COLLEGE_CYCLES: CycleDef[] = [
  {
    name: "Collège",
    order: 0,
    classes: [
      { name: "6ème", order: 0, groupes: [{ letter: "A", targetSize: 30 }] },
      { name: "5ème", order: 1, groupes: [{ letter: "A", targetSize: 28 }] },
    ],
  },
];

const COLLEGE_SALLES: SalleDef[] = [
  { name: "Salle 1", capacity: 32, type: "Standard" },
  { name: "Salle 2", capacity: 30, type: "Standard" },
];

// Sous-ensemble du barème d'ÉCOLE EXCELLENCE (mêmes noms de classe, montants
// PROPRES à cette école — `FeeLevel` est scopé par école via `classeId`,
// voir schema.prisma) : prouve au passage que les deux écoles ont bien des
// barèmes indépendants malgré le même nom de classe.
const COLLEGE_FEE_LEVELS: [string, number, number][] = [
  ["6ème", 140000, 14000],
  ["5ème", 145000, 14500],
];

const COLLEGE_STUDENTS: StudentDef[] = [
  {
    matricule: "CAM-0001",
    fullName: "MSAIDIE Halima",
    birthDate: "2013-04-12",
    birthPlace: "Mutsamudu",
    sex: Sex.F,
    parentName: "MSAIDIE Ahmed",
    parentPhone: "+269 321 55 10",
    className: "6ème A",
    nationalIdNumber: "KM-CI-0011002",
    ministryStudentNumber: "MEN-2024-010001",
  },
  {
    matricule: "CAM-0002",
    fullName: "ABOUBACAR Fahmi",
    birthDate: "2013-01-30",
    birthPlace: "Domoni",
    sex: Sex.M,
    parentName: "ABOUBACAR Said",
    parentPhone: "+269 332 55 21",
    className: "6ème A",
    nationalIdNumber: "KM-CI-0011003",
  },
  {
    matricule: "CAM-0003",
    fullName: "ATTOUMANI Nadia",
    birthDate: "2012-09-08",
    birthPlace: "Mutsamudu",
    sex: Sex.F,
    parentName: "ATTOUMANI Bacar",
    parentPhone: "+269 345 55 32",
    className: "5ème A",
    ministryStudentNumber: "MEN-2024-010003",
  },
  // Voir le commentaire d'en-tête : même personne réelle que EL-0002
  // (ÉCOLE EXCELLENCE) — même `nationalIdNumber`, même nom de parent/
  // téléphone/lieu de naissance, transférée l'année suivante après un
  // retour de la famille à Anjouan. `ministryStudentNumber` volontairement
  // absent ici (une école n'hérite pas nécessairement du numéro ministère
  // saisi par l'ancienne).
  {
    matricule: "CAM-0004",
    fullName: "MOHAMED Chaharazade",
    birthDate: "2012-07-22",
    birthPlace: "Mutsamudu",
    sex: Sex.F,
    parentName: "MOHAMED Ali",
    parentPhone: "+269 332 23 45",
    className: "5ème A",
    nationalIdNumber: "KM-CI-0004821",
  },
];

const COLLEGE_STAFF: StaffDef[] = [
  {
    slug: "camar-nour-djamal",
    fullName: "M. DJAMAL Nour",
    specialite: "Mathématiques",
    fonction: "Enseignant",
    diplome: "Licence en Mathématiques — Université des Comores",
    typeContrat: "CDI",
    salaireBrut: 200000,
    heuresSemaine: 16,
  },
  {
    slug: "camar-halima-ali",
    fullName: "Mme ALI Halima",
    specialite: "Français",
    fonction: "Enseignante",
    diplome: "Maîtrise de Lettres Modernes — Université des Comores",
    typeContrat: "CDD",
    salaireBrut: 180000,
    heuresSemaine: 14,
  },
];

const COLLEGE_SUBJECTS: SubjectDef[] = [
  {
    name: "Mathématiques",
    coefficient: 4,
    hoursPerWeek: 5,
    teacherSlug: "camar-nour-djamal",
  },
  {
    name: "Français",
    coefficient: 4,
    hoursPerWeek: 5,
    teacherSlug: "camar-halima-ali",
  },
];

const COLLEGE_TIMETABLE: TimetableEntryDef[] = [
  {
    className: "6ème A",
    day: "Lundi",
    startTime: "07h30",
    endTime: "08h30",
    subject: "Mathématiques",
    teacherSlug: "camar-nour-djamal",
    salle: "Salle 1",
  },
  {
    className: "6ème A",
    day: "Mardi",
    startTime: "08h30",
    endTime: "09h30",
    subject: "Français",
    teacherSlug: "camar-halima-ali",
    salle: "Salle 1",
  },
  {
    className: "5ème A",
    day: "Lundi",
    startTime: "08h30",
    endTime: "09h30",
    subject: "Mathématiques",
    teacherSlug: "camar-nour-djamal",
    salle: "Salle 2",
  },
  {
    className: "5ème A",
    day: "Mardi",
    startTime: "07h30",
    endTime: "08h30",
    subject: "Français",
    teacherSlug: "camar-halima-ali",
    salle: "Salle 2",
  },
];

const COLLEGE_FINANCES: FinanceEntryDef[] = [
  {
    month: 1,
    type: FinanceEntryType.RECETTE,
    label: "Frais de scolarité perçus",
    amount: 900000,
  },
  {
    month: 1,
    type: FinanceEntryType.CHARGE,
    label: "Salaires du personnel",
    amount: 500000,
  },
  {
    month: 2,
    type: FinanceEntryType.RECETTE,
    label: "Frais de scolarité perçus",
    amount: 950000,
  },
  {
    month: 2,
    type: FinanceEntryType.CHARGE,
    label: "Salaires du personnel",
    amount: 500000,
  },
];

// ============================================================================
// École 3 — LYCÉE DE MWALI (Mohéli, Fomboni)
// ============================================================================

const LYCEE_MWALI_ID = "00000000-0000-0000-0000-000000000003";

const LYCEE_DEF: AdditionalSchoolDef = {
  id: LYCEE_MWALI_ID,
  name: "LYCÉE DE MWALI",
  director: {
    fullName: "M. ATTOUMANI Housni",
    email: "directeur@lycee-mwali.km",
    password: "Directeur123!",
  },
  address: "Fomboni, Mohéli",
  island: "Mohéli",
  phone: "+269 772 30 00",
  email: "contact@lycee-mwali.km",
  arreteNumber: "ARR-MEN-2025-031",
  cycle: "Lycée",
  schoolYearLabel: "2024-2025",
};

// Un seul cycle (Lycée), deux classes SANS série (contrairement à celles
// d'ÉCOLE EXCELLENCE — illustre qu'une série reste optionnelle, comme déjà
// documenté dans structure.seed.ts).
const LYCEE_CYCLES: CycleDef[] = [
  {
    name: "Lycée",
    order: 0,
    classes: [
      { name: "Seconde", order: 0, groupes: [{ letter: "A", targetSize: 25 }] },
      {
        name: "Terminale",
        order: 1,
        groupes: [{ letter: "A", targetSize: 20 }],
      },
    ],
  },
];

const LYCEE_SALLES: SalleDef[] = [
  { name: "Salle 1", capacity: 28, type: "Standard" },
  { name: "Salle 2", capacity: 24, type: "Standard" },
];

const LYCEE_FEE_LEVELS: [string, number, number][] = [
  ["Seconde", 170000, 17000],
  ["Terminale", 175000, 17500],
];

const LYCEE_STUDENTS: StudentDef[] = [
  {
    matricule: "MWA-0001",
    fullName: "ALI Soumaila",
    birthDate: "2009-03-14",
    birthPlace: "Fomboni",
    sex: Sex.M,
    parentName: "ALI Bacar",
    parentPhone: "+269 373 66 10",
    className: "Seconde A",
    nationalIdNumber: "KM-CI-0021001",
    ministryStudentNumber: "MEN-2024-020001",
  },
  {
    matricule: "MWA-0002",
    fullName: "BOINA Nadia",
    birthDate: "2009-11-02",
    birthPlace: "Fomboni",
    sex: Sex.F,
    parentName: "BOINA Youssouf",
    parentPhone: "+269 374 66 21",
    className: "Seconde A",
    ministryStudentNumber: "MEN-2024-020002",
  },
  // Voir le commentaire d'en-tête : même personne réelle que EL-0007
  // (ÉCOLE EXCELLENCE) — même `ministryStudentNumber`, même nom de parent/
  // téléphone/lieu de naissance, transférée deux ans plus tard (Seconde ->
  // Terminale). `nationalIdNumber` volontairement DIFFÉRENT (propre à
  // chaque fiche) : la correspondance ici ne passe QUE par le numéro
  // ministère, pour exercer ce second champ de recherche séparément du
  // premier (voir CAM-0004 ci-dessus, qui exerce l'autre).
  {
    matricule: "MWA-0003",
    fullName: "RIZIKI Nadjim",
    birthDate: "2009-04-10",
    birthPlace: "Moroni",
    sex: Sex.M,
    parentName: "RIZIKI Djaffar",
    parentPhone: "+269 402 78 90",
    className: "Terminale A",
    nationalIdNumber: "KM-CI-0009951",
    ministryStudentNumber: "MEN-2022-003311",
  },
  {
    matricule: "MWA-0004",
    fullName: "CHAMSOUDINE Rahma",
    birthDate: "2008-12-20",
    birthPlace: "Fomboni",
    sex: Sex.F,
    parentName: "CHAMSOUDINE Saidi",
    parentPhone: "+269 376 66 32",
    className: "Terminale A",
    nationalIdNumber: "KM-CI-0021004",
  },
];

const LYCEE_STAFF: StaffDef[] = [
  {
    slug: "mwali-djae-ali",
    fullName: "M. ALI Djaé",
    specialite: "Mathématiques",
    fonction: "Enseignant",
    diplome: "Licence en Mathématiques — Université des Comores",
    typeContrat: "CDI",
    salaireBrut: 210000,
    heuresSemaine: 18,
  },
  {
    slug: "mwali-nadia-said",
    fullName: "Mme SAID Nadia",
    specialite: "Anglais",
    fonction: "Enseignante",
    diplome: "Licence d'Anglais — Université des Comores",
    typeContrat: "CDD",
    salaireBrut: 190000,
    heuresSemaine: 15,
  },
];

const LYCEE_SUBJECTS: SubjectDef[] = [
  {
    name: "Mathématiques",
    coefficient: 4,
    hoursPerWeek: 5,
    teacherSlug: "mwali-djae-ali",
  },
  {
    name: "Anglais",
    coefficient: 3,
    hoursPerWeek: 4,
    teacherSlug: "mwali-nadia-said",
  },
];

const LYCEE_TIMETABLE: TimetableEntryDef[] = [
  {
    className: "Seconde A",
    day: "Lundi",
    startTime: "07h30",
    endTime: "08h30",
    subject: "Mathématiques",
    teacherSlug: "mwali-djae-ali",
    salle: "Salle 1",
  },
  {
    className: "Seconde A",
    day: "Mardi",
    startTime: "08h30",
    endTime: "09h30",
    subject: "Anglais",
    teacherSlug: "mwali-nadia-said",
    salle: "Salle 1",
  },
  {
    className: "Terminale A",
    day: "Lundi",
    startTime: "08h30",
    endTime: "09h30",
    subject: "Mathématiques",
    teacherSlug: "mwali-djae-ali",
    salle: "Salle 2",
  },
  {
    className: "Terminale A",
    day: "Mardi",
    startTime: "07h30",
    endTime: "08h30",
    subject: "Anglais",
    teacherSlug: "mwali-nadia-said",
    salle: "Salle 2",
  },
];

const LYCEE_FINANCES: FinanceEntryDef[] = [
  {
    month: 1,
    type: FinanceEntryType.RECETTE,
    label: "Frais de scolarité perçus",
    amount: 700000,
  },
  {
    month: 1,
    type: FinanceEntryType.CHARGE,
    label: "Salaires du personnel",
    amount: 450000,
  },
  {
    month: 2,
    type: FinanceEntryType.RECETTE,
    label: "Frais de scolarité perçus",
    amount: 720000,
  },
  {
    month: 2,
    type: FinanceEntryType.CHARGE,
    label: "Salaires du personnel",
    amount: 450000,
  },
];

// ============================================================================
// Orchestration
// ============================================================================

async function seedOneAdditionalSchool(
  prisma: PrismaClient,
  def: AdditionalSchoolDef,
  cycles: CycleDef[],
  salles: SalleDef[],
  feeLevels: [string, number, number][],
  studentDefs: StudentDef[],
  staffDefs: StaffDef[],
  subjectDefs: SubjectDef[],
  schedule: TimetableEntryDef[],
  financeEntries: FinanceEntryDef[],
): Promise<SeededAdditionalSchool> {
  const school = await seedAdditionalSchool(prisma, def);
  const {
    classeIdByName,
    groupes,
    salles: salleMap,
  } = await seedStructure(prisma, school, cycles, salles);
  const feeLevelAmounts = await seedParameters(
    prisma,
    school,
    classeIdByName,
    feeLevels,
  );
  const students = await seedStudents(prisma, school, groupes, studentDefs);
  const staff = await seedPersonnel(prisma, school, staffDefs);
  const subjects = await seedSubjects(
    prisma,
    school,
    groupes,
    staff,
    subjectDefs,
  );
  await seedEnrollments(prisma, school, feeLevelAmounts, students);
  await seedTuitionFees(prisma, school, feeLevelAmounts, students);
  await seedGrades(prisma, students, subjects);
  await seedAttendance(prisma, students);
  await seedTimetable(prisma, school, groupes, staff, salleMap, schedule);
  await seedFinances(prisma, school, financeEntries);

  return {
    school,
    name: def.name,
    directorEmail: def.director.email,
    classeIdByName,
    subjects,
  };
}

export async function seedAdditionalSchools(
  prisma: PrismaClient,
): Promise<SeededAdditionalSchool[]> {
  const college = await seedOneAdditionalSchool(
    prisma,
    COLLEGE_DEF,
    COLLEGE_CYCLES,
    COLLEGE_SALLES,
    COLLEGE_FEE_LEVELS,
    COLLEGE_STUDENTS,
    COLLEGE_STAFF,
    COLLEGE_SUBJECTS,
    COLLEGE_TIMETABLE,
    COLLEGE_FINANCES,
  );
  const lycee = await seedOneAdditionalSchool(
    prisma,
    LYCEE_DEF,
    LYCEE_CYCLES,
    LYCEE_SALLES,
    LYCEE_FEE_LEVELS,
    LYCEE_STUDENTS,
    LYCEE_STAFF,
    LYCEE_SUBJECTS,
    LYCEE_TIMETABLE,
    LYCEE_FINANCES,
  );

  return [college, lycee];
}
