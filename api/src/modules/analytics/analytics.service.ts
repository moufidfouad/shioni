import { prisma, AttendanceStatus } from "../../config/prisma";
import { computeAverage } from "../grades/grades.service";

interface EffectifRow {
  id: string;
  name: string;
  count: number;
}

export async function getAnalyticsOverview(schoolId: string) {
  const [cycles, classes, series, groupes, salles, students, params] =
    await Promise.all([
      prisma.cycle.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
      prisma.classe.findMany({
        where: { schoolId },
        orderBy: { order: "asc" },
      }),
      prisma.serie.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
      prisma.groupe.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
      prisma.salle.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
      prisma.student.findMany({
        where: { schoolId },
        select: { id: true, groupeId: true },
      }),
      prisma.schoolParameters.findUnique({ where: { schoolId } }),
    ]);

  const classeById = new Map(classes.map((c) => [c.id, c]));
  const groupeById = new Map(groupes.map((g) => [g.id, g]));

  // ------------------------------------------------------------------------
  // EFFECTIFS — par groupe, remonté vers série/classe/cycle. Un groupe SANS
  // élève apparaît quand même (count: 0), même chose pour une classe/série
  // sans aucun groupe.
  // ------------------------------------------------------------------------
  const countByGroupe = new Map<string, number>();
  let sansGroupe = 0;
  for (const s of students) {
    if (!s.groupeId) {
      sansGroupe += 1;
      continue;
    }
    countByGroupe.set(s.groupeId, (countByGroupe.get(s.groupeId) ?? 0) + 1);
  }

  const effectifsByGroupe: (EffectifRow & {
    classeId: string;
    serieId: string | null;
  })[] = groupes.map((g) => ({
    id: g.id,
    name: `${classeById.get(g.classeId)?.name ?? "?"} ${g.name}`,
    classeId: g.classeId,
    serieId: g.serieId,
    count: countByGroupe.get(g.id) ?? 0,
  }));

  const effectifsByClasse: (EffectifRow & { cycleId: string })[] = classes.map(
    (c) => ({
      id: c.id,
      name: c.name,
      cycleId: c.cycleId,
      count: effectifsByGroupe
        .filter((g) => g.classeId === c.id)
        .reduce((sum, g) => sum + g.count, 0),
    }),
  );

  const effectifsBySerie: (EffectifRow & { classeId: string })[] = series.map(
    (s) => ({
      id: s.id,
      name: `${classeById.get(s.classeId)?.name ?? "?"} ${s.name}`,
      classeId: s.classeId,
      count: effectifsByGroupe
        .filter((g) => g.serieId === s.id)
        .reduce((sum, g) => sum + g.count, 0),
    }),
  );

  const effectifsByCycle: EffectifRow[] = cycles.map((cy) => ({
    id: cy.id,
    name: cy.name,
    count: effectifsByClasse
      .filter((c) => c.cycleId === cy.id)
      .reduce((sum, c) => sum + c.count, 0),
  }));

  // ------------------------------------------------------------------------
  // PRÉSENCES — taux de présence ((présent + retard) / total) par groupe,
  // remonté vers cycle. Toutes années/mois confondus (même périmètre que
  // `getSchoolAttendanceOverview`, pas de filtre par date ici).
  // ------------------------------------------------------------------------
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { student: { schoolId } },
    select: { status: true, student: { select: { groupeId: true } } },
  });

  const attendanceByGroupe = new Map<
    string,
    { present: number; total: number }
  >();
  for (const r of attendanceRecords) {
    const groupeId = r.student.groupeId;
    if (!groupeId) continue;
    const entry = attendanceByGroupe.get(groupeId) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (
      r.status === AttendanceStatus.PRESENT ||
      r.status === AttendanceStatus.RETARD
    )
      entry.present += 1;
    attendanceByGroupe.set(groupeId, entry);
  }

  const tauxPresenceByGroupe = groupes.map((g) => {
    const entry = attendanceByGroupe.get(g.id);
    return {
      id: g.id,
      name: `${classeById.get(g.classeId)?.name ?? "?"} ${g.name}`,
      tauxPresence:
        entry && entry.total > 0 ? (entry.present / entry.total) * 100 : null,
      total: entry?.total ?? 0,
    };
  });

  const tauxPresenceByCycle = cycles.map((cy) => {
    const groupeIds = new Set(
      effectifsByGroupe
        .filter((g) => classeById.get(g.classeId)?.cycleId === cy.id)
        .map((g) => g.id),
    );
    let present = 0;
    let total = 0;
    for (const [groupeId, entry] of attendanceByGroupe) {
      if (!groupeIds.has(groupeId)) continue;
      present += entry.present;
      total += entry.total;
    }
    return {
      id: cy.id,
      name: cy.name,
      tauxPresence: total > 0 ? (present / total) * 100 : null,
      total,
    };
  });

  // ------------------------------------------------------------------------
  // MOYENNES — trimestre en cours (`SchoolParameters.trimestreEnCours`),
  // moyenne SIMPLE des moyennes de matière par élève (Σ moyennes / nb
  // matières notées), volontairement SANS pondération par coefficient — un
  // calcul plus riche existe déjà par élève (bulletin, voir
  // `grades.service.ts::getStudentBulletin`) ; celui-ci vise une vue
  // d'ensemble par classe/série/groupe, pas un document officiel.
  // ------------------------------------------------------------------------
  const trimestre = params?.trimestreEnCours ?? 1;
  const grades = await prisma.grade.findMany({
    where: { trimestre, student: { schoolId } },
    select: { evaluations: true, student: { select: { groupeId: true } } },
  });

  const gradeAveragesByGroupe = new Map<string, number[]>();
  for (const g of grades) {
    const avg = computeAverage(g.evaluations);
    if (avg === null) continue;
    const groupeId = g.student.groupeId;
    if (!groupeId) continue;
    const list = gradeAveragesByGroupe.get(groupeId) ?? [];
    list.push(avg);
    gradeAveragesByGroupe.set(groupeId, list);
  }

  function mean(values: number[]): number | null {
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }

  const moyenneByGroupe = groupes.map((g) => ({
    id: g.id,
    name: `${classeById.get(g.classeId)?.name ?? "?"} ${g.name}`,
    moyenne: mean(gradeAveragesByGroupe.get(g.id) ?? []),
  }));

  const moyenneByClasse = classes.map((c) => {
    const values = groupes
      .filter((g) => g.classeId === c.id)
      .flatMap((g) => gradeAveragesByGroupe.get(g.id) ?? []);
    return { id: c.id, name: c.name, moyenne: mean(values) };
  });

  const moyenneBySerie = series.map((s) => {
    const values = groupes
      .filter((g) => g.serieId === s.id)
      .flatMap((g) => gradeAveragesByGroupe.get(g.id) ?? []);
    return {
      id: s.id,
      name: `${classeById.get(s.classeId)?.name ?? "?"} ${s.name}`,
      moyenne: mean(values),
    };
  });

  // ------------------------------------------------------------------------
  // SALLES — occupation. PAS un pourcentage : aucune référence fiable
  // "heures disponibles max" n'existe dans le schéma (voir le commentaire de
  // conception dans le README) — juste des heures réservées/semaine, brutes,
  // pour ne jamais inventer une donnée absente.
  // ------------------------------------------------------------------------
  const timetableEntries = await prisma.timetableEntry.findMany({
    where: { schoolId },
    select: { salleId: true, startTime: true, endTime: true },
  });

  function parseHeure(t: string): number {
    const [h, m] = t.replace("h", ":").split(":").map(Number);
    return h + m / 60;
  }

  const occupancyBySalle = new Map<string, { hours: number; count: number }>();
  for (const entry of timetableEntries) {
    if (!entry.salleId) continue;
    const duration = Math.max(
      0,
      parseHeure(entry.endTime) - parseHeure(entry.startTime),
    );
    const current = occupancyBySalle.get(entry.salleId) ?? {
      hours: 0,
      count: 0,
    };
    current.hours += duration;
    current.count += 1;
    occupancyBySalle.set(entry.salleId, current);
  }

  const salleOccupancy = salles.map((s) => {
    const current = occupancyBySalle.get(s.id);
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      capacity: s.capacity,
      hoursPerWeek: current ? Math.round(current.hours * 100) / 100 : 0,
      entryCount: current?.count ?? 0,
    };
  });

  return {
    trimestre,
    structure: {
      cycles: cycles.map((c) => ({ id: c.id, name: c.name })),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        cycleId: c.cycleId,
      })),
      series: series.map((s) => ({
        id: s.id,
        name: s.name,
        classeId: s.classeId,
      })),
      groupes: groupes.map((g) => ({
        id: g.id,
        name: g.name,
        classeId: g.classeId,
        serieId: g.serieId,
      })),
      salles: salles.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        capacity: s.capacity,
      })),
    },
    effectifs: {
      sansGroupe,
      byCycle: effectifsByCycle,
      byClasse: effectifsByClasse,
      bySerie: effectifsBySerie,
      byGroupe: effectifsByGroupe,
    },
    presence: {
      byCycle: tauxPresenceByCycle,
      byGroupe: tauxPresenceByGroupe,
    },
    moyennes: {
      byClasse: moyenneByClasse,
      bySerie: moyenneBySerie,
      byGroupe: moyenneByGroupe,
    },
    salles: salleOccupancy,
  };
}
