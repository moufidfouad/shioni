import { prisma, AttendanceStatus } from "../../config/prisma";
import { computeAverage } from "../grades/grades.service";

interface NamedRow {
  name: string;
  count: number;
}

function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

// Agrège une liste de { key, order } en lignes triées par le plus petit
// `order` observé pour cette clé — les écoles de ce projet numérotent leurs
// cycles/classes de façon pédagogiquement cohérente (voir seeds), donc le
// minimum reste un ordre lisible même une fois fusionné entre écoles.
function sortByMinOrder<T extends { name: string }>(
  rows: T[],
  orderByName: Map<string, number>,
): T[] {
  return [...rows].sort(
    (a, b) => (orderByName.get(a.name) ?? 0) - (orderByName.get(b.name) ?? 0),
  );
}

export async function getGlobalStats() {
  const [
    schools,
    cycles,
    classes,
    series,
    students,
    schoolYears,
    enrollments,
    schoolParametersList,
  ] = await Promise.all([
    prisma.school.findMany({ select: { id: true, name: true, island: true } }),
    prisma.cycle.findMany({
      select: { id: true, name: true, order: true, schoolId: true },
    }),
    prisma.classe.findMany({
      select: {
        id: true,
        name: true,
        order: true,
        cycleId: true,
        schoolId: true,
      },
    }),
    prisma.serie.findMany({
      select: {
        id: true,
        name: true,
        order: true,
        classeId: true,
        schoolId: true,
      },
    }),
    prisma.student.findMany({
      select: { id: true, schoolId: true, groupeId: true },
    }),
    prisma.schoolYear.findMany({
      select: { id: true, label: true, order: true },
    }),
    prisma.enrollment.findMany({
      select: { studentId: true, schoolYearId: true },
    }),
    prisma.schoolParameters.findMany({
      select: { schoolId: true, trimestreEnCours: true },
    }),
  ]);

  // Le groupe est la seule entité qui relie un élève à sa classe/série/cycle
  // (`Student.groupeId`) — récupéré séparément avec juste ce qu'il faut
  // (classeId/serieId) plutôt que via une inclusion Prisma imbriquée.
  const groupes = await prisma.groupe.findMany({
    select: { id: true, classeId: true, serieId: true },
  });

  const cycleById = new Map(cycles.map((c) => [c.id, c]));
  const classeById = new Map(classes.map((c) => [c.id, c]));
  const serieById = new Map(series.map((s) => [s.id, s]));
  const groupeById = new Map(groupes.map((g) => [g.id, g]));
  const schoolYearById = new Map(schoolYears.map((y) => [y.id, y]));
  const trimestreBySchool = new Map(
    schoolParametersList.map((p) => [p.schoolId, p.trimestreEnCours]),
  );
  const studentById = new Map(students.map((s) => [s.id, s]));

  // Résout un élève -> { cycleName, classeName, serieName } via son groupe
  // courant (limite assumée : reflète l'affectation ACTUELLE, pas celle de
  // l'année d'une inscription passée — voir le commentaire de tête).
  function resolvePlacement(studentId: string) {
    const student = studentById.get(studentId);
    if (!student?.groupeId) return null;
    const groupe = groupeById.get(student.groupeId);
    if (!groupe) return null;
    const classe = classeById.get(groupe.classeId);
    if (!classe) return null;
    const cycle = cycleById.get(classe.cycleId);
    const serie = groupe.serieId ? serieById.get(groupe.serieId) : null;
    return {
      cycleName: cycle?.name ?? null,
      classeName: classe.name,
      // Composé "classe série" (ex "Seconde L"), même convention que
      // `analytics.service.ts::effectifsBySerie` — un simple "L" serait
      // ambigu une fois fusionné entre plusieurs classes/écoles.
      serieName: serie ? `${classe.name} ${serie.name}` : null,
    };
  }

  // --------------------------------------------------------------------
  // EFFECTIFS — par année (via Enrollment), par cycle/classe/série (via le
  // placement courant de l'élève, toutes écoles confondues).
  // --------------------------------------------------------------------
  const effectifsByYear = new Map<string, number>();
  for (const e of enrollments) {
    const label = schoolYearById.get(e.schoolYearId)?.label;
    if (!label) continue;
    effectifsByYear.set(label, (effectifsByYear.get(label) ?? 0) + 1);
  }

  const effectifsByCycle = new Map<string, number>();
  const effectifsByClasse = new Map<string, number>();
  const effectifsBySerie = new Map<string, number>();
  let sansPlacement = 0;
  for (const s of students) {
    const placement = resolvePlacement(s.id);
    if (!placement) {
      sansPlacement += 1;
      continue;
    }
    if (placement.cycleName)
      effectifsByCycle.set(
        placement.cycleName,
        (effectifsByCycle.get(placement.cycleName) ?? 0) + 1,
      );
    effectifsByClasse.set(
      placement.classeName,
      (effectifsByClasse.get(placement.classeName) ?? 0) + 1,
    );
    if (placement.serieName)
      effectifsBySerie.set(
        placement.serieName,
        (effectifsBySerie.get(placement.serieName) ?? 0) + 1,
      );
  }

  const cycleOrderByName = new Map<string, number>();
  for (const c of cycles)
    if (
      !cycleOrderByName.has(c.name) ||
      c.order < cycleOrderByName.get(c.name)!
    )
      cycleOrderByName.set(c.name, c.order);
  const classeOrderByName = new Map<string, number>();
  for (const c of classes)
    if (
      !classeOrderByName.has(c.name) ||
      c.order < classeOrderByName.get(c.name)!
    )
      classeOrderByName.set(c.name, c.order);
  const serieOrderByName = new Map<string, number>();
  for (const s of series) {
    const classe = classeById.get(s.classeId);
    if (!classe) continue;
    const composed = `${classe.name} ${s.name}`;
    const order = classe.order * 100 + s.order;
    if (
      !serieOrderByName.has(composed) ||
      order < serieOrderByName.get(composed)!
    )
      serieOrderByName.set(composed, order);
  }

  function toRows(map: Map<string, number>): NamedRow[] {
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }

  const effectifs = {
    total: students.length,
    sansPlacement,
    byYear: Array.from(effectifsByYear.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    byCycle: sortByMinOrder(toRows(effectifsByCycle), cycleOrderByName),
    byClasse: sortByMinOrder(toRows(effectifsByClasse), classeOrderByName),
    bySerie: sortByMinOrder(toRows(effectifsBySerie), serieOrderByName),
  };

  // --------------------------------------------------------------------
  // PRÉSENCE — taux ((présent + retard) / total), toutes années confondues
  // (voir limite en tête de fichier), par cycle/classe/série.
  // --------------------------------------------------------------------
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    select: { status: true, studentId: true },
  });

  function aggregatePresence(keyOf: (studentId: string) => string | null) {
    const byKey = new Map<string, { present: number; total: number }>();
    for (const r of attendanceRecords) {
      const key = keyOf(r.studentId);
      if (!key) continue;
      const entry = byKey.get(key) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (
        r.status === AttendanceStatus.PRESENT ||
        r.status === AttendanceStatus.RETARD
      )
        entry.present += 1;
      byKey.set(key, entry);
    }
    return byKey;
  }

  function presenceRows(
    byKey: Map<string, { present: number; total: number }>,
    orderByName?: Map<string, number>,
  ) {
    const rows = Array.from(byKey.entries()).map(
      ([name, { present, total }]) => ({
        name,
        tauxPresence: total > 0 ? (present / total) * 100 : null,
        total,
      }),
    );
    return orderByName
      ? sortByMinOrder(rows, orderByName)
      : rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  const presenceByCycleMap = aggregatePresence(
    (id) => resolvePlacement(id)?.cycleName ?? null,
  );
  const presenceByClasseMap = aggregatePresence(
    (id) => resolvePlacement(id)?.classeName ?? null,
  );
  const presenceBySerieMap = aggregatePresence(
    (id) => resolvePlacement(id)?.serieName ?? null,
  );

  const presence = {
    byCycle: presenceRows(presenceByCycleMap, cycleOrderByName),
    byClasse: presenceRows(presenceByClasseMap, classeOrderByName),
    bySerie: presenceRows(presenceBySerieMap, serieOrderByName),
  };

  // --------------------------------------------------------------------
  // MOYENNES — moyenne simple des moyennes de matière par élève (même
  // formule que `analytics.service.ts`), trimestre en cours DE L'ÉCOLE DE
  // CHAQUE ÉLÈVE (`SchoolParameters.trimestreEnCours` varie par école — pas
  // un seul trimestre global à appliquer partout).
  // --------------------------------------------------------------------
  const grades = await prisma.grade.findMany({
    select: {
      trimestre: true,
      evaluations: true,
      student: { select: { id: true, schoolId: true } },
    },
  });

  function aggregateMoyennes(keyOf: (studentId: string) => string | null) {
    const byKey = new Map<string, number[]>();
    for (const g of grades) {
      const trimestreEcole = trimestreBySchool.get(g.student.schoolId) ?? 1;
      if (g.trimestre !== trimestreEcole) continue;
      const avg = computeAverage(g.evaluations);
      if (avg === null) continue;
      const key = keyOf(g.student.id);
      if (!key) continue;
      const list = byKey.get(key) ?? [];
      list.push(avg);
      byKey.set(key, list);
    }
    return byKey;
  }

  function moyenneRows(
    byKey: Map<string, number[]>,
    orderByName?: Map<string, number>,
  ) {
    const rows = Array.from(byKey.entries()).map(([name, values]) => ({
      name,
      moyenne: mean(values),
    }));
    return orderByName
      ? sortByMinOrder(rows, orderByName)
      : rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  const moyennes = {
    byCycle: moyenneRows(
      aggregateMoyennes((id) => resolvePlacement(id)?.cycleName ?? null),
      cycleOrderByName,
    ),
    byClasse: moyenneRows(
      aggregateMoyennes((id) => resolvePlacement(id)?.classeName ?? null),
      classeOrderByName,
    ),
    bySerie: moyenneRows(
      aggregateMoyennes((id) => resolvePlacement(id)?.serieName ?? null),
      serieOrderByName,
    ),
  };

  // --------------------------------------------------------------------
  // PAR ÉCOLE — un tableau de comparaison (effectif, présence, moyenne
  // actuels), demandé explicitement en complément des totaux consolidés
  // ci-dessus.
  // --------------------------------------------------------------------
  const presenceBySchool = aggregatePresence(
    (id) => studentById.get(id)?.schoolId ?? null,
  );
  const moyennesBySchool = aggregateMoyennes(
    (id) => studentById.get(id)?.schoolId ?? null,
  );
  const effectifsBySchool = new Map<string, number>();
  for (const s of students)
    effectifsBySchool.set(
      s.schoolId,
      (effectifsBySchool.get(s.schoolId) ?? 0) + 1,
    );

  const byEcole = schools
    .map((school) => {
      const presenceEntry = presenceBySchool.get(school.id);
      return {
        id: school.id,
        name: school.name,
        island: school.island ?? null,
        effectifs: effectifsBySchool.get(school.id) ?? 0,
        tauxPresence:
          presenceEntry && presenceEntry.total > 0
            ? (presenceEntry.present / presenceEntry.total) * 100
            : null,
        moyenneGenerale: mean(moyennesBySchool.get(school.id) ?? []),
      };
    })
    .sort((a, b) => b.effectifs - a.effectifs);

  return {
    schoolsCount: schools.length,
    effectifs,
    presence,
    moyennes,
    byEcole,
  };
}
