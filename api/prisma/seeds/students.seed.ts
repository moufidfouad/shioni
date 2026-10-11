import type { PrismaClient } from "../../src/generated/prisma/client";
import { Sex } from "../../src/config/prisma";
import type { SeededSchool } from "./school.seed";
import type { SeededGroupe } from "./structure.seed";

export interface SeededStudent {
  id: string;
  matricule: string;
  fullName: string;
  groupeName: string;
  groupeId: string;

  classeName: string;
}

export interface StudentDef {
  matricule: string;
  fullName: string;
  birthDate: string;
  birthPlace: string;
  sex: (typeof Sex)[keyof typeof Sex];
  parentName: string;
  parentPhone: string;
  className: string;
  nationalIdNumber?: string;
  ministryStudentNumber?: string;
}


const STUDENTS: StudentDef[] = [
  {
    matricule: "EL-0001",
    fullName: "AHMED Nourdine",
    birthDate: "2012-03-15",
    birthPlace: "Moroni",
    sex: Sex.M,
    parentName: "AHMED Saïd",
    parentPhone: "+269 321 12 34",
    className: "6ème A",
    nationalIdNumber: "KM-CI-0001123",
    ministryStudentNumber: "MEN-2022-000114",
  },
  {
    matricule: "EL-0002",
    fullName: "MOHAMED Chaharazade",
    birthDate: "2012-07-22",
    birthPlace: "Mutsamudu",
    sex: Sex.F,
    parentName: "MOHAMED Ali",
    parentPhone: "+269 332 23 45",
    className: "6ème A",
    nationalIdNumber: "KM-CI-0004821",
    ministryStudentNumber: "MEN-2023-001542",
  },
  {
    matricule: "EL-0003",
    fullName: "SOILIHI Abdou",
    birthDate: "2011-11-05",
    birthPlace: "Moroni",
    sex: Sex.M,
    parentName: "SOILIHI Fatima",
    parentPhone: "+269 345 34 56",
    className: "5ème A",
    nationalIdNumber: "KM-CI-0002234",
    ministryStudentNumber: "MEN-2021-000229",
  },

  {
    matricule: "EL-0004",
    fullName: "BACAR Zainaba",
    birthDate: "2011-02-18",
    birthPlace: "Fomboni",
    sex: Sex.F,
    parentName: "BACAR Mohamed",
    parentPhone: "+269 361 45 67",
    className: "5ème A",
    ministryStudentNumber: "MEN-2021-000341",
  },

  {
    matricule: "EL-0005",
    fullName: "YOUSSOUF Chamsudine",
    birthDate: "2010-09-30",
    birthPlace: "Mitsamiouli",
    sex: Sex.M,
    parentName: "YOUSSOUF Halifa",
    parentPhone: "+269 376 56 78",
    className: "4ème A",
    nationalIdNumber: "KM-CI-0003345",
  },

  
  {
    matricule: "EL-0006",
    fullName: "ABDOU Halima",
    birthDate: "2010-05-12",
    birthPlace: "Domoni",
    sex: Sex.F,
    parentName: "ABDOU Toihir",
    parentPhone: "+269 390 67 89",
    className: "4ème B",
    nationalIdNumber: "KM-CI-0003456",
    ministryStudentNumber: "MEN-2020-000452",
  },


  {
    matricule: "EL-0007",
    fullName: "RIZIKI Nadjim",
    birthDate: "2009-04-10",
    birthPlace: "Moroni",
    sex: Sex.M,
    parentName: "RIZIKI Djaffar",
    parentPhone: "+269 402 78 90",
    className: "Seconde L A",
    nationalIdNumber: "KM-CI-0007733",
    ministryStudentNumber: "MEN-2022-003311",
  },
  {
    matricule: "EL-0008",
    fullName: "ATTOUMANI Nawal",
    birthDate: "2009-08-25",
    birthPlace: "Mutsamudu",
    sex: Sex.F,
    parentName: "ATTOUMANI Saindou",
    parentPhone: "+269 415 89 01",
    className: "Seconde G A",
    nationalIdNumber: "KM-CI-0007844",
    ministryStudentNumber: "MEN-2022-003422",
  },
  {
    matricule: "EL-0009",
    fullName: "CHAKIR Anli",
    birthDate: "2008-12-03",
    birthPlace: "Fomboni",
    sex: Sex.M,
    parentName: "CHAKIR Bacar",
    parentPhone: "+269 428 90 12",
    className: "Seconde G B",
    nationalIdNumber: "KM-CI-0007955",
    ministryStudentNumber: "MEN-2021-003533",
  },
  {
    matricule: "EL-0010",
    fullName: "MSA Rahma",
    birthDate: "2008-02-14",
    birthPlace: "Mitsamiouli",
    sex: Sex.F,
    parentName: "MSA Abdillah",
    parentPhone: "+269 431 01 23",
    className: "Première L A",
    nationalIdNumber: "KM-CI-0008066",
    ministryStudentNumber: "MEN-2021-003644",
  },
  {
    matricule: "EL-0011",
    fullName: "ABDALLAH Fahad",
    birthDate: "2007-06-19",
    birthPlace: "Domoni",
    sex: Sex.M,
    parentName: "ABDALLAH Nourdine",
    parentPhone: "+269 447 12 34",
    className: "Première S A",
    nationalIdNumber: "KM-CI-0008177",
    ministryStudentNumber: "MEN-2020-003755",
  },
  {
    matricule: "EL-0012",
    fullName: "HOUMADI Sitti",
    birthDate: "2006-10-30",
    birthPlace: "Moroni",
    sex: Sex.F,
    parentName: "HOUMADI Chamsudine",
    parentPhone: "+269 456 23 45",
    className: "Terminale S A",
    nationalIdNumber: "KM-CI-0008288",
    ministryStudentNumber: "MEN-2019-003866",
  },
];


export async function seedStudents(
  prisma: PrismaClient,
  school: SeededSchool,
  groupes: Map<string, SeededGroupe>,
  studentDefs: StudentDef[] = STUDENTS,
): Promise<Map<string, SeededStudent>> {
  const students = new Map<string, SeededStudent>();

  for (const s of studentDefs) {
    const groupe = groupes.get(s.className);
    if (!groupe)
      throw new Error(`Classe inconnue dans le seed élèves : "${s.className}"`);

    const student = await prisma.student.upsert({
      where: {
        schoolId_matricule: { schoolId: school.id, matricule: s.matricule },
      },
      update: {
        nationalIdNumber: s.nationalIdNumber ?? null,
        ministryStudentNumber: s.ministryStudentNumber ?? null,
      },
      create: {
        schoolId: school.id,
        matricule: s.matricule,
        fullName: s.fullName,
        birthDate: new Date(s.birthDate),
        birthPlace: s.birthPlace,
        sex: s.sex,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        groupeId: groupe.id,
        nationalIdNumber: s.nationalIdNumber,
        ministryStudentNumber: s.ministryStudentNumber,
      },
    });

    students.set(s.matricule, {
      id: student.id,
      matricule: s.matricule,
      fullName: s.fullName,
      groupeName: s.className,
      groupeId: groupe.id,
      classeName: groupe.classeName,
    });
  }

  return students;
}
