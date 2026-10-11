import { prisma, AttendanceStatus } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { assertGroupeInScope, TeacherScope } from "../../utils/teacherScope";
import {
  buildPaginationMeta,
  PaginationQuery,
  toSkipTake,
} from "../../utils/pagination";
import {
  intersectGroupeIds,
  resolveGroupeIds,
  StructureFilter,
} from "../../utils/structureFilter";
import { getTokensForUsers } from "../push-tokens/push-tokens.service";
import {
  sendExpoPushNotifications,
  ExpoPushMessage,
} from "../../utils/expoPush";
import type {
  AttendanceInput,
  BulkAttendanceInput,
  UpdateAttendanceInput,
} from "./attendance.schema";

async function notifyAbsenceGuardians(
  schoolId: string,
  studentIds: string[],
  date: string,
): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    const links = await prisma.studentGuardian.findMany({
      where: { studentId: { in: studentIds }, student: { schoolId } },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (links.length === 0) return;

    const guardianIds = Array.from(new Set(links.map((l) => l.userId)));
    const tokens = await getTokensForUsers(guardianIds);
    if (tokens.length === 0) return;

    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens) {
      const list = tokensByUser.get(t.userId) ?? [];
      list.push(t.token);
      tokensByUser.set(t.userId, list);
    }

    const dateFr = formatDateFr(date);
    const messages: ExpoPushMessage[] = [];
    for (const link of links) {
      const userTokens = tokensByUser.get(link.userId);
      if (!userTokens || userTokens.length === 0) continue;
      for (const token of userTokens) {
        messages.push({
          to: token,
          title: "Absence signalée",
          body: `${link.student.fullName} a été marqué(e) absent(e) le ${dateFr}.`,
          // `kind` distingue ce déclencheur de la Messagerie côté mobile
          // (voir mobile/src/lib/pushNotifications.ts::
          // extractAbsenceNotificationData) — `studentId` permet de
          // naviguer directement vers le résumé de l'enfant concerné
          // (`children/[studentId]`), pas seulement l'école.
          data: { schoolId, studentId: link.studentId, kind: "absence" },
        });
      }
    }
    if (messages.length > 0) await sendExpoPushNotifications(messages);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[push] Échec de notification d'absence aux parents (ignoré) :",
      err,
    );
  }
}

function formatDateFr(date: string): string {
  const [y, m, d] = date.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : date;
}

const studentSelect = {
  select: { id: true, matricule: true, fullName: true, groupeId: true },
} as const;

async function assertStudentInSchool(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
  });
  if (!student) throw ApiError.notFound("Élève introuvable dans cette école.");
  return student;
}

async function assertGroupeInSchool(schoolId: string, groupeId: string) {
  const groupe = await prisma.groupe.findFirst({
    where: { id: groupeId, schoolId },
  });
  if (!groupe) throw ApiError.notFound("Classe introuvable dans cette école.");
  return groupe;
}

export interface AttendanceFilters extends StructureFilter {
  studentId?: string;
  status?: AttendanceStatus;
  dateFrom?: string;
  dateTo?: string;
}

function dateRangeWhere(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined;
  return {
    gte: dateFrom ? new Date(dateFrom) : undefined,
    // `lte` sur une simple date (sans heure) inclurait par défaut minuit
    // pile — on pousse `dateTo` à la fin de la journée pour que la borne
    // haute soit bien incluse dans le filtre.
    lte: dateTo ? new Date(`${dateTo}T23:59:59.999`) : undefined,
  };
}

async function buildAttendanceWhere(
  schoolId: string,
  opts: AttendanceFilters,
  scope: TeacherScope | null,
) {
  if (scope && opts.groupeId) assertGroupeInScope(scope, opts.groupeId);
  // Itération 35 — filtres par cycle/classe/série en plus du groupeId.
  const structureGroupeIds = await resolveGroupeIds(schoolId, opts);
  const scopeGroupeIds = scope ? Array.from(scope.groupeIds) : undefined;
  const finalGroupeIds = intersectGroupeIds(structureGroupeIds, scopeGroupeIds);
  const groupeFilter = finalGroupeIds ? { in: finalGroupeIds } : undefined;
  return {
    studentId: opts.studentId || undefined,
    status: opts.status || undefined,
    date: dateRangeWhere(opts.dateFrom, opts.dateTo),
    student: { schoolId, groupeId: groupeFilter },
  };
}

export async function listAttendance(
  schoolId: string,
  opts: AttendanceFilters,
  scope: TeacherScope | null = null,
  pagination: PaginationQuery,
) {
  const where = await buildAttendanceWhere(schoolId, opts, scope);
  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: { student: studentSelect },
      orderBy: [{ date: "desc" }, { student: { fullName: "asc" } }],
      ...toSkipTake(pagination),
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  return { data: records, pagination: buildPaginationMeta(total, pagination) };
}

export async function listAllAttendance(
  schoolId: string,
  opts: AttendanceFilters,
  scope: TeacherScope | null = null,
) {
  const where = await buildAttendanceWhere(schoolId, opts, scope);
  return prisma.attendanceRecord.findMany({
    where,
    include: { student: studentSelect },
    orderBy: [{ date: "desc" }, { student: { fullName: "asc" } }],
  });
}

export async function getAttendance(
  schoolId: string,
  id: string,
  scope: TeacherScope | null = null,
) {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id, student: { schoolId } },
    include: { student: studentSelect },
  });
  if (!record)
    throw ApiError.notFound("Enregistrement de présence introuvable.");
  if (scope) assertGroupeInScope(scope, record.student.groupeId ?? "");
  return record;
}

export async function createAttendance(
  schoolId: string,
  input: AttendanceInput,
  scope: TeacherScope | null = null,
) {
  const student = await assertStudentInSchool(schoolId, input.studentId);
  if (scope) assertGroupeInScope(scope, student.groupeId ?? "");
  const record = await prisma.attendanceRecord.create({
    data: {
      studentId: input.studentId,
      date: new Date(input.date),
      status: input.status,
      subject: input.subject,
      heure: input.heure,
      motif: input.motif,
      justifiee: input.justifiee,
    },
    include: { student: studentSelect },
  });
  if (input.status === AttendanceStatus.ABSENT) {
    void notifyAbsenceGuardians(schoolId, [input.studentId], input.date);
  }
  return record;
}

export async function updateAttendance(
  schoolId: string,
  id: string,
  input: UpdateAttendanceInput,
  scope: TeacherScope | null = null,
) {
  const existing = await getAttendance(schoolId, id, scope);
  const record = await prisma.attendanceRecord.update({
    where: { id },
    data: {
      status: input.status,
      subject: input.subject,
      heure: input.heure,
      motif: input.motif,
      justifiee: input.justifiee,
    },
    include: { student: studentSelect },
  });
  if (input.status === AttendanceStatus.ABSENT) {
    void notifyAbsenceGuardians(
      schoolId,
      [existing.studentId],
      existing.date.toISOString(),
    );
  }
  return record;
}

export async function deleteAttendance(
  schoolId: string,
  id: string,
  scope: TeacherScope | null = null,
) {
  await getAttendance(schoolId, id, scope);
  await prisma.attendanceRecord.delete({ where: { id } });
}

// Saisie groupée pour une classe entière, un jour donné (cahier de présence
// quotidien) : pas de contrainte d'unicité en base à exploiter via `upsert`
// (comme pour les notes, itération 11) — on retrouve un éventuel
// enregistrement "journée entière" déjà saisi (`subject: null`) pour cet
// élève et cette date, sinon on en crée un, dans une transaction
// interactive pour que l'ensemble reste atomique. Une ré-ouverture de la
// saisie pour la même classe/date met donc à jour les lignes existantes au
// lieu de les dupliquer.
export async function bulkSetAttendance(
  schoolId: string,
  input: BulkAttendanceInput,
  scope: TeacherScope | null = null,
) {
  await assertGroupeInSchool(schoolId, input.groupeId);
  if (scope) assertGroupeInScope(scope, input.groupeId);
  for (const row of input.records) {
    await assertStudentInSchool(schoolId, row.studentId);
  }

  const day = new Date(input.date);
  const dayStart = new Date(`${input.date}T00:00:00.000`);
  const dayEnd = new Date(`${input.date}T23:59:59.999`);

  // Correctif audit (N+1) — la version précédente faisait UN findFirst PAR
  // ÉLÈVE à l'intérieur de la transaction pour savoir s'il existait déjà un
  // enregistrement "journée entière" (subject: null) ce jour-là. On
  // précharge maintenant tous les enregistrements existants de cette
  // classe/date en UNE seule requête, puis on ne fait plus, par ligne,
  // qu'un update (une valeur différente par ligne, donc pas batchable via
  // `updateMany`) ou un create — les creates étant eux groupés en un seul
  // `createMany`.
  const result = await prisma.$transaction(async (tx) => {
    const studentIds = input.records.map((r) => r.studentId);

    const existingRecords = studentIds.length
      ? await tx.attendanceRecord.findMany({
          where: {
            studentId: { in: studentIds },
            subject: null,
            date: { gte: dayStart, lte: dayEnd },
          },
        })
      : [];
    // Un seul enregistrement "journée entière" (subject: null) par élève et
    // par jour, invariant déjà supposé par le `findFirst` d'origine (il ne
    // regardait que le premier trouvé) — une Map par studentId le préserve.
    const existingByStudent = new Map(
      existingRecords.map((r) => [r.studentId, r]),
    );

    type RowData = {
      status: AttendanceStatus;
      heure?: string;
      motif?: string;
      justifiee?: boolean;
    };
    const toCreate: (RowData & { studentId: string; date: Date })[] = [];
    const toUpdateByStudent = new Map<string, { id: string; data: RowData }>();
    // `input.records` pourrait en théorie répéter un studentId (comme pour
    // `bulkSetGradeEvaluation`) : un `Map` clé par studentId — mis à jour au
    // fil de la boucle, y compris pour les lignes tout juste ajoutées à
    // `toCreate` — garantit qu'une répétition met à jour la même ligne
    // plutôt que d'en créer un doublon, exactement comme le ferait la
    // version séquentielle d'origine (2e passage : `findFirst` aurait
    // retrouvé la ligne créée au 1er passage).
    const pendingCreateByStudent = new Map<
      string,
      RowData & { studentId: string; date: Date }
    >();

    for (const row of input.records) {
      const data: RowData = {
        status: row.status,
        heure: row.heure ?? undefined,
        motif: row.motif ?? undefined,
        justifiee: row.justifiee ?? undefined,
      };
      const existing = existingByStudent.get(row.studentId);
      if (existing) {
        toUpdateByStudent.set(row.studentId, { id: existing.id, data });
        continue;
      }
      const pending = pendingCreateByStudent.get(row.studentId);
      if (pending) {
        pending.status = data.status;
        pending.heure = data.heure;
        pending.motif = data.motif;
        pending.justifiee = data.justifiee;
      } else {
        const created = { studentId: row.studentId, date: day, ...data };
        toCreate.push(created);
        pendingCreateByStudent.set(row.studentId, created);
      }
    }
    const toUpdate = Array.from(toUpdateByStudent.values());

    if (toCreate.length) {
      await tx.attendanceRecord.createMany({ data: toCreate });
    }
    const updatedRecords = await Promise.all(
      toUpdate.map((u) =>
        tx.attendanceRecord.update({ where: { id: u.id }, data: u.data }),
      ),
    );

    // Itération 87 — élèves dont la valeur FINALE de cette saisie groupée
    // est ABSENT (voir notifyAbsenceGuardians plus haut) : `toCreate` et
    // `toUpdateByStudent` (clé = studentId) contiennent chacun déjà, par
    // construction ci-dessus, au plus UNE ligne par élève (la dernière
    // valeur saisie en cas de répétition dans `input.records`) — une simple
    // union des deux suffit, pas de risque de doublon entre les deux
    // sources (un élève est soit une création, soit une mise à jour, jamais
    // les deux).
    const absentStudentIds = [
      ...toCreate
        .filter((r) => r.status === AttendanceStatus.ABSENT)
        .map((r) => r.studentId),
      ...Array.from(toUpdateByStudent.entries())
        .filter(([, u]) => u.data.status === AttendanceStatus.ABSENT)
        .map(([studentId]) => studentId),
    ];

    // `createMany` ne renvoie pas les lignes créées : le frontend
    // (useBulkSetAttendanceMutation, features/attendance/api.ts) n'exploite
    // que le succès de l'appel pour invalider son cache — jamais le corps de
    // la réponse — donc renvoyer un compte plutôt que le tableau complet des
    // lignes (avec leurs valeurs éventuellement obsolètes pour les créations)
    // reste un changement de forme sans impact.
    return {
      updated: toCreate.length + updatedRecords.length,
      absentStudentIds,
    };
  });

  // Hors transaction (best-effort, ne doit jamais faire échouer/retarder la
  // saisie — voir le commentaire de notifyAbsenceGuardians) : forme de
  // retour inchangée pour l'appelant HTTP (`{updated}`, voir le commentaire
  // ci-dessus sur `useBulkSetAttendanceMutation`), `absentStudentIds` n'est
  // qu'un détail d'implémentation interne à cette fonction.
  void notifyAbsenceGuardians(schoolId, result.absentStudentIds, input.date);
  return { updated: result.updated };
}

// Récapitulatif d'assiduité d'une classe sur une période : nombre de
// présences/absences/retards par élève + un taux de présence, pour repérer
// rapidement les élèves à surveiller. `RETARD` compte comme "présent"
// (l'élève est bien venu, juste en retard) dans le taux, tout en restant
// affiché séparément — choix documenté, cohérent avec le sens usuel d'un
// "taux de présence" scolaire. Trié par nombre d'absences décroissant (les
// élèves les plus concernés en tête) plutôt que par ordre alphabétique.
export async function getAttendanceStats(
  schoolId: string,
  groupeId: string,
  dateFrom?: string,
  dateTo?: string,
  scope: TeacherScope | null = null,
) {
  const groupe = await assertGroupeInSchool(schoolId, groupeId);
  if (scope) assertGroupeInScope(scope, groupeId);

  const students = await prisma.student.findMany({
    where: { schoolId, groupeId },
    orderBy: { fullName: "asc" },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      date: dateRangeWhere(dateFrom, dateTo),
    },
  });

  const rows = students.map((student) => {
    const own = records.filter((r) => r.studentId === student.id);
    const present = own.filter(
      (r) => r.status === AttendanceStatus.PRESENT,
    ).length;
    const absent = own.filter(
      (r) => r.status === AttendanceStatus.ABSENT,
    ).length;
    const retard = own.filter(
      (r) => r.status === AttendanceStatus.RETARD,
    ).length;
    const total = present + absent + retard;
    return {
      student: {
        id: student.id,
        matricule: student.matricule,
        fullName: student.fullName,
      },
      present,
      absent,
      retard,
      total,
      tauxPresence: total > 0 ? ((present + retard) / total) * 100 : null,
    };
  });

  rows.sort(
    (a, b) =>
      b.absent - a.absent ||
      a.student.fullName.localeCompare(b.student.fullName),
  );

  const totals = rows.reduce(
    (acc, r) => ({
      present: acc.present + r.present,
      absent: acc.absent + r.absent,
      retard: acc.retard + r.retard,
    }),
    { present: 0, absent: 0, retard: 0 },
  );
  const totalAll = totals.present + totals.absent + totals.retard;

  return {
    groupe: { id: groupe.id, name: groupe.name },
    students: rows,
    totals: {
      ...totals,
      total: totalAll,
      tauxPresence:
        totalAll > 0
          ? ((totals.present + totals.retard) / totalAll) * 100
          : null,
    },
  };
}

// Vue d'ensemble toutes classes confondues, pour le Tableau de bord
// (itération 16) : mêmes totaux que `getAttendanceStats` mais sans le
// détail par élève ni la contrainte d'une classe précise — un simple
// `groupBy`-maison sur tous les enregistrements de l'école, sans période
// par défaut (l'historique complet, comme pour les autres cartes du
// tableau de bord qui n'ont pas de notion de "période" naturelle).
export async function getSchoolAttendanceOverview(schoolId: string) {
  const records = await prisma.attendanceRecord.findMany({
    where: { student: { schoolId } },
    select: { status: true },
  });
  const present = records.filter(
    (r) => r.status === AttendanceStatus.PRESENT,
  ).length;
  const absent = records.filter(
    (r) => r.status === AttendanceStatus.ABSENT,
  ).length;
  const retard = records.filter(
    (r) => r.status === AttendanceStatus.RETARD,
  ).length;
  const total = present + absent + retard;

  return {
    present,
    absent,
    retard,
    total,
    tauxPresence: total > 0 ? ((present + retard) / total) * 100 : null,
  };
}
