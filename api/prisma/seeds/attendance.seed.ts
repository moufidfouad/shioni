import type { PrismaClient } from "../../src/generated/prisma/client";
import { AttendanceStatus } from "../../src/config/prisma";
import type { SeededStudent } from "./students.seed";
import { seedId } from "./ids";

// `AttendanceRecord` n'a pas de contrainte d'unicité en base (le module
// applicatif retrouve un enregistrement "journée entière" existant via
// `subject: null` + la date — voir `attendance.service.ts::bulkSetAttendance`,
// itération 13) : upsert sur un id dérivé de `matricule + date`, avec
// `subject: null` pour rester cohérent avec cette même convention.
//
// Une semaine de démo (lundi à vendredi), essentiellement "Présent" avec
// quelques absences/retards répartis de façon déterministe pour que le
// récapitulatif (taux de présence, tri par absences) ait quelque chose à
// montrer dès le premier chargement.
const WEEK_DATES = ["2024-10-07", "2024-10-08", "2024-10-09", "2024-10-10", "2024-10-11"];

function statusFor(studentIndex: number, dayIndex: number): (typeof AttendanceStatus)[keyof typeof AttendanceStatus] {
  if (studentIndex === 4 && dayIndex === 2) return AttendanceStatus.ABSENT;
  if (studentIndex === 1 && dayIndex === 0) return AttendanceStatus.RETARD;
  if (studentIndex === 5 && dayIndex === 4) return AttendanceStatus.ABSENT;
  return AttendanceStatus.PRESENT;
}

export async function seedAttendance(prisma: PrismaClient, students: Map<string, SeededStudent>) {
  const studentList = [...students.values()];

  for (const [studentIndex, student] of studentList.entries()) {
    for (const [dayIndex, dateStr] of WEEK_DATES.entries()) {
      const status = statusFor(studentIndex, dayIndex);
      const id = seedId(`attendance:${student.matricule}:${dateStr}`);
      const extra =
        status === AttendanceStatus.ABSENT
          ? { motif: "Maladie", justifiee: true }
          : status === AttendanceStatus.RETARD
            ? { heure: "07h45", motif: "Retard de transport", justifiee: false }
            : {};

      await prisma.attendanceRecord.upsert({
        where: { id },
        update: { status, ...extra },
        create: {
          id,
          studentId: student.id,
          date: new Date(dateStr),
          status,
          subject: null,
          ...extra,
        },
      });
    }
  }
}
