import { ReactNode, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import {
  TIMETABLE_DAYS,
  TeachingScope,
  TimetableEntry,
  Classe,
  Serie,
} from "@/types";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import { useSubjectsQuery } from "@/features/subjects/api";
import { useStaffQuery } from "@/features/personnel/api";
import { useMyTeachingScopeQuery } from "@/features/me/api";
import {
  useCreateTimetableEntryMutation,
  useDeleteTimetableEntryMutation,
  useTimetableQuery,
  useUpdateTimetableEntryMutation,
} from "@/features/timetable/api";
import PageHeader from "@/components/PageHeader";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FormDialog from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TextInputField, SelectField } from "@/components/form";
import PageTransition from "@/components/motion/PageTransition";
import { groupeLabel, groupeLabelById } from "@/lib/groupeLabel";
import { useDebouncedValue } from "@/providers/hooks/useDebouncedValue";

// Convertit entre le format natif de l'input HTML `type="time"` ("HH:MM",
// utilisé dans les `values` Formik pour profiter du sélecteur du
// navigateur) et le format stocké côté API ("HHhMM", repris tel quel de
// l'exemple du schéma Prisma — voir timetable.schema.ts côté backend).
function toApiTime(hhmm: string) {
  return hhmm.replace(":", "h");
}
function fromApiTime(hhmm: string) {
  return hhmm.replace("h", ":");
}

// Itération 29 — un compte Enseignant restreint ne doit voir/gérer que ses
// propres classes.
function filterGroupesByScope<T extends { id: string }>(
  groupes: T[],
  scope?: TeachingScope,
): T[] {
  if (!scope || !scope.restricted) return groupes;
  const allowed = new Set(scope.groupeIds);
  return groupes.filter((c) => allowed.has(c.id));
}

// Reflète la feuille Excel "EMPLOI DU TEMPS", avec deux vues distinctes
// (même patron que Grades.tsx/Attendance.tsx) : l'édition classe par classe
// (grille hebdomadaire, workflow principal) et une vue "par enseignant" —
// possible parce que `teacherName` est un champ texte libre partagé entre
// plusieurs classes, ce que ni Grades ni Attendance n'ont (leurs deux vues
// portent toutes deux sur UNE classe) : un enseignant intervenant dans
// plusieurs classes peut ainsi consulter tout son planning en une recherche,
// sans avoir à ouvrir chaque classe une par une.
export default function Timetable() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const parametersQuery = useSchoolParametersQuery(school.id);
  const scopeQuery = useMyTeachingScopeQuery(school.id);
  const groupes = filterGroupesByScope(
    parametersQuery.data?.groupes ?? [],
    scopeQuery.data,
  );
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];

  const [view, setView] = useState<"classe" | "enseignant">("classe");

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Emploi du temps"
        description="Créneaux hebdomadaires par classe."
        actions={
          <div className="flex gap-2">
            <Button
              variant={view === "classe" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("classe")}
            >
              Par classe
            </Button>
            <Button
              variant={view === "enseignant" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("enseignant")}
            >
              Par enseignant
            </Button>
          </div>
        }
      />

      {view === "classe" ? (
        <TimetableByClass
          schoolId={school.id}
          groupes={groupes}
          classes={classes}
          series={series}
          salles={parametersQuery.data?.salles ?? []}
          scope={scopeQuery.data}
        />
      ) : (
        <TimetableByTeacher
          schoolId={school.id}
          groupes={groupes}
          classes={classes}
          series={series}
        />
      )}
    </PageTransition>
  );
}

// ----------------------------------------------------------------------------
// Vue "Tableau" — demande utilisateur : "dans vue emploi du temps, ajouter
// une vue tableau, avec colonnes jour et lignes tranche d'heures". Vient en
// complément de la liste `DataTable` déjà existante (basculée via un
// toggle "Liste"/"Tableau" dans chacune des deux vues ci-dessous), pas en
// remplacement — la liste reste le seul endroit où créer un créneau,
// la grille est une lecture visuelle "classique" de l'emploi du temps.
//
// Itération 42 — rectification demandée : « le pas entre créneau est de 30
// minutes, si le nombre d'heures de cours est supérieur au pas, spanner la
// cellule. ajouter des couleurs pour différencier les créneaux ». Ancien
// comportement (itération 39, corrigé ici) : les lignes étaient dérivées des
// seules paires `startTime`-`endTime` réellement présentes dans les
// créneaux affichés — un cours de 07h30 à 09h00 (90 min) produisait une
// unique ligne "07h30 – 09h00", incohérent avec une lecture "par tranche de
// 30 minutes" et incapable de s'aligner avec un autre cours de 45 min
// commençant à la même heure. Désormais : lignes = grille à PAS FIXE de 30
// minutes (constante `GRID_STEP_MINUTES`), bornée au minimum au plus tôt
// `startTime` et au plus tard `endTime` réellement affichés (arrondis
// respectivement au multiple de 30 inférieur/supérieur) ; un créneau dont la
// durée dépasse ce pas occupe plusieurs lignes via l'attribut HTML natif
// `rowSpan` (`Math.ceil(durée / 30)`, arrondi supérieur si la durée n'est
// pas un multiple exact de 30 minutes — cas rare, `startTime`/`endTime`
// restant du texte libre au format "HHhMM", voir timetable.schema.ts). Une
// ligne "couverte" par le `rowSpan` d'une ligne précédente n'émet AUCUNE
// cellule `<td>` pour ce jour (le modèle de table HTML l'exige : émettre un
// `<td>` vide à la place décalerait toutes les colonnes suivantes) — voir
// `dayPlans` ci-dessous, qui précalcule pour chaque jour × ligne l'un de
// trois états ("entry" démarre ici, "skip" couvert par un rowSpan
// au-dessus, "empty" case vide). Une cellule n'a jamais plus d'un créneau à
// afficher : les deux vues appelantes ne listent chacune que les créneaux
// d'UNE seule classe ou d'UN seul enseignant, et `assertNoConflict`
// (backend) empêche déjà tout chevauchement horaire au même jour pour une
// même classe/un même enseignant — donc jamais deux créneaux ne se
// disputent la même ligne de grille pour un même jour.
//
// Couleurs — chaque matière (`subjectName`) reçoit une couleur catégorielle
// stable (palette validée par le skill data-viz du projet, `--pairs`
// adjacents, voir `validate_palette.js`), assignée dans l'ordre de première
// apparition chronologique (jour puis heure) plutôt qu'alphabétique, pour
// que les toutes premières matières de la semaine héritent des teintes les
// plus distinctes. Au-delà de 8 matières simultanément affichées, la
// palette boucle (huitième slot réutilisé) : un choix assumé pour cet usage
// de simple différenciation visuelle dans une grille (pas un graphique avec
// légende stricte à respecter) plutôt que de replier les matières
// excédentaires dans un slot "Autre" qui n'aurait aucun sens ici. Un
// créneau sans matière renseignée reste en gris neutre plutôt que de
// consommer un slot de la palette. La couleur habille un liseré + un fond
// légèrement teinté (`color-mix`) — jamais le texte lui-même, qui reste en
// couleurs sémantiques standard (voir "relief rule" du skill data-viz : le
// nom de la matière reste toujours affiché en clair dans la cellule, donc
// l'identité n'est jamais portée par la seule couleur).
const GRID_STEP_MINUTES = 30;

// 8 teintes catégorielles validées (palette de référence du skill data-viz
// du projet) : ordre CVD-safe sur les paires adjacentes, ΔE protan/tritan
// >= 8, ΔE vision normale >= 15 — voir la note ci-dessus sur l'usage en
// boucle au-delà de 8 matières.
const SUBJECT_COLOR_PALETTE = [
  "#2a78d6", // bleu
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // jaune
  "#e87ba4", // magenta
  "#008300", // vert
  "#4a3aa7", // violet
  "#e34948", // rouge
];
const NO_SUBJECT_COLOR = "#9ca3af"; // gris neutre — aucune matière renseignée

function parseApiTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split("h").map(Number);
  return h * 60 + (m || 0);
}
function minutesToGridLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

// Assigne une couleur stable par matière, dans l'ordre de première
// apparition chronologique (jour de la semaine puis heure de début).
function useSubjectColors(entries: TimetableEntry[]) {
  return useMemo(() => {
    const dayRank = new Map(TIMETABLE_DAYS.map((d, i) => [d, i]));
    const chronological = [...entries].sort(
      (a, b) =>
        (dayRank.get(a.day) ?? 0) - (dayRank.get(b.day) ?? 0) ||
        a.startTime.localeCompare(b.startTime),
    );
    const colors = new Map<string, string>();
    for (const e of chronological) {
      const name = e.subjectName?.trim();
      if (!name || colors.has(name)) continue;
      colors.set(
        name,
        SUBJECT_COLOR_PALETTE[colors.size % SUBJECT_COLOR_PALETTE.length],
      );
    }
    return colors;
  }, [entries]);
}
function subjectColor(
  subjectName: string | null | undefined,
  colors: Map<string, string>,
): string {
  const name = subjectName?.trim();
  return (name && colors.get(name)) || NO_SUBJECT_COLOR;
}

type GridCell =
  | { type: "entry"; entry: TimetableEntry; span: number }
  | { type: "empty" }
  | { type: "skip" };

function TimetableGrid({
  entries,
  renderCell,
}: {
  entries: TimetableEntry[];
  renderCell: (entry: TimetableEntry) => ReactNode;
}) {
  const subjectColors = useSubjectColors(entries);

  const rows = useMemo(() => {
    if (entries.length === 0) return [];
    const starts = entries.map((e) => parseApiTimeToMinutes(e.startTime));
    const ends = entries.map((e) => parseApiTimeToMinutes(e.endTime));
    const gridStart =
      Math.floor(Math.min(...starts) / GRID_STEP_MINUTES) * GRID_STEP_MINUTES;
    const gridEnd =
      Math.ceil(Math.max(...ends) / GRID_STEP_MINUTES) * GRID_STEP_MINUTES;
    const result: { start: number; end: number }[] = [];
    for (let t = gridStart; t < gridEnd; t += GRID_STEP_MINUTES) {
      result.push({ start: t, end: t + GRID_STEP_MINUTES });
    }
    return result;
  }, [entries]);

  // Précalcule, pour chaque jour et chaque ligne de la grille, l'état de la
  // cellule (voir le commentaire au-dessus de `GRID_STEP_MINUTES`).
  const dayPlans = useMemo(() => {
    if (rows.length === 0) return new Map<string, GridCell[]>();
    const gridStart = rows[0].start;
    const plans = new Map<string, GridCell[]>();
    for (const day of TIMETABLE_DAYS) {
      plans.set(
        day,
        Array.from(
          { length: rows.length },
          () => ({ type: "empty" }) as GridCell,
        ),
      );
    }
    for (const entry of entries) {
      const plan = plans.get(entry.day);
      if (!plan) continue;
      const start = parseApiTimeToMinutes(entry.startTime);
      const end = parseApiTimeToMinutes(entry.endTime);
      const startRow = Math.floor(
        (Math.floor(start / GRID_STEP_MINUTES) * GRID_STEP_MINUTES -
          gridStart) /
          GRID_STEP_MINUTES,
      );
      const span = Math.max(1, Math.ceil((end - start) / GRID_STEP_MINUTES));
      if (startRow < 0 || startRow >= rows.length) continue; // garde-fou, ne devrait pas arriver
      plan[startRow] = { type: "entry", entry, span };
      for (
        let i = startRow + 1;
        i < Math.min(rows.length, startRow + span);
        i++
      ) {
        plan[i] = { type: "skip" };
      }
    }
    return plans;
  }, [entries, rows]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucun créneau à afficher.</p>
    );
  }

  return (
    <div className="space-y-3">
      {subjectColors.size > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {[...subjectColors.entries()].map(([name, color]) => (
            <span key={name} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              {name}
            </span>
          ))}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Horaire</TableHead>
            {TIMETABLE_DAYS.map((d) => (
              <TableHead key={d}>{d}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIdx) => (
            <TableRow key={row.start}>
              <TableCell className="align-top text-xs font-medium whitespace-nowrap text-muted-foreground">
                {minutesToGridLabel(row.start)} – {minutesToGridLabel(row.end)}
              </TableCell>
              {TIMETABLE_DAYS.map((day) => {
                const cell = dayPlans.get(day)?.[rowIdx] ?? { type: "empty" };
                if (cell.type === "skip") return null;
                if (cell.type === "entry") {
                  const color = subjectColor(
                    cell.entry.subjectName,
                    subjectColors,
                  );
                  return (
                    <TableCell
                      key={day}
                      rowSpan={cell.span}
                      className="align-top p-1.5"
                    >
                      <div
                        className="h-full rounded-md border-l-4 p-2"
                        style={{
                          borderLeftColor: color,
                          backgroundColor: `color-mix(in srgb, ${color} 14%, white)`,
                        }}
                      >
                        {renderCell(cell.entry)}
                      </div>
                    </TableCell>
                  );
                }
                return (
                  <TableCell key={day} className="align-top">
                    <span className="text-muted-foreground">—</span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Vue "Par classe"
// ----------------------------------------------------------------------------

interface EntryFormValues {
  day: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string;
  // Itération 35 — demande utilisateur : "un créneau avec ... salle".
  salleId: string;
}

const emptyEntryValues: EntryFormValues = {
  day: "",
  startTime: "",
  endTime: "",
  subjectName: "",
  teacherName: "",
  salleId: "",
};

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const EntrySchema = Yup.object({
  day: Yup.string()
    .oneOf(TIMETABLE_DAYS as unknown as string[], "Jour invalide.")
    .required("Le jour est requis."),
  startTime: Yup.string()
    .matches(timeRegex, "Heure invalide.")
    .required("L'heure de début est requise."),
  endTime: Yup.string()
    .matches(timeRegex, "Heure invalide.")
    .required("L'heure de fin est requise.")
    .test("after-start", "Doit être après l'heure de début.", function (value) {
      const { startTime } = this.parent as { startTime?: string };
      return !value || !startTime || value > startTime;
    }),
  subjectName: Yup.string().optional(),
  teacherName: Yup.string().optional(),
  salleId: Yup.string().optional(),
});

function TimetableByClass({
  schoolId,
  groupes,
  classes,
  series,
  salles,
  scope,
}: {
  schoolId: string;
  groupes: {
    id: string;
    name: string;
    classeId: string;
    serieId?: string | null;
  }[];
  classes: Pick<Classe, "id" | "name">[];
  series: Pick<Serie, "id" | "name">[];
  salles: { id: string; name: string }[];
  scope?: TeachingScope;
}) {
  const [groupeId, setGroupeId] = useState("");
  const entriesQuery = useTimetableQuery(schoolId, {
    groupeId: groupeId || undefined,
  });
  const subjectsQuery = useSubjectsQuery(schoolId);
  // `all: true` — la liste des noms d'enseignants ci-dessous a besoin de TOUT
  // le personnel (voir features/personnel/api.ts::PageParams).
  const staffQuery = useStaffQuery(schoolId, {}, { all: true });
  const createEntry = useCreateTimetableEntryMutation(schoolId);
  const updateEntry = useUpdateTimetableEntryMutation(schoolId);
  const deleteEntry = useDeleteTimetableEntryMutation(schoolId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialValues, setInitialValues] =
    useState<EntryFormValues>(emptyEntryValues);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [display, setDisplay] = useState<"liste" | "tableau">("liste");

  const entries = groupeId ? (entriesQuery.data ?? []) : [];
  const subjectNames = useMemo(
    () => [...new Set((subjectsQuery.data ?? []).map((s) => s.name))],
    [subjectsQuery.data],
  );
  const staffNames = useMemo(
    () => [...new Set((staffQuery.data?.data ?? []).map((m) => m.fullName))],
    [staffQuery.data],
  );

  // Itération 29 — un compte Enseignant scopé ne peut créer/modifier un
  // créneau qu'à SON propre nom : le backend force de toute façon teacherId/
  // teacherName côté serveur (voir timetable.service.ts), donc on préremplit
  // et verrouille ce champ ici pour ne pas laisser croire qu'un autre nom
  // pourrait être saisi.
  const ownTeacherName =
    scope && scope.restricted ? scope.staffMemberFullName : null;

  function startCreate() {
    setEditingId(null);
    setInitialValues(
      ownTeacherName
        ? { ...emptyEntryValues, teacherName: ownTeacherName }
        : emptyEntryValues,
    );
    setShowForm(true);
  }

  function startEdit(entry: TimetableEntry) {
    setEditingId(entry.id);
    setInitialValues({
      day: entry.day,
      startTime: fromApiTime(entry.startTime),
      endTime: fromApiTime(entry.endTime),
      subjectName: entry.subjectName ?? "",
      teacherName: ownTeacherName ?? entry.teacherName ?? "",
      salleId: entry.salleId ?? "",
    });
    setShowForm(true);
  }

  async function handleSubmit(
    values: EntryFormValues,
    helpers: FormikHelpers<EntryFormValues>,
  ) {
    const payload = {
      groupeId,
      day: values.day,
      startTime: toApiTime(values.startTime),
      endTime: toApiTime(values.endTime),
      subjectName: values.subjectName || undefined,
      teacherName: values.teacherName || undefined,
      salleId: values.salleId || null,
    };
    try {
      if (editingId) {
        await updateEntry.mutateAsync({ id: editingId, payload });
        toast.success("Créneau mis à jour.");
      } else {
        await createEntry.mutateAsync(payload);
        toast.success("Créneau ajouté à l'emploi du temps.");
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteEntry.mutateAsync(pendingDeleteId);
      toast.success("Créneau supprimé.");
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const pendingEntry = entries.find((e) => e.id === pendingDeleteId);

  const columns: DataTableColumn<TimetableEntry>[] = [
    { header: "Jour", cell: (e) => <Badge variant="outline">{e.day}</Badge> },
    { header: "Horaire", cell: (e) => `${e.startTime} – ${e.endTime}` },
    {
      header: "Matière",
      cell: (e) =>
        e.subjectName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Enseignant",
      cell: (e) =>
        e.teacherName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Salle",
      cell: (e) =>
        e.salle?.name ?? <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Classe</Label>
          <Select
            value={groupeId}
            onValueChange={(v) => {
              setGroupeId(v);
              setShowForm(false);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choisir une classe…" />
            </SelectTrigger>
            <SelectContent>
              {groupes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {groupeLabel(c, classes, series)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {groupeId && (
          <div className="flex items-end gap-2">
            <div className="flex gap-2">
              <Button
                variant={display === "liste" ? "default" : "outline"}
                size="sm"
                onClick={() => setDisplay("liste")}
              >
                Liste
              </Button>
              <Button
                variant={display === "tableau" ? "default" : "outline"}
                size="sm"
                onClick={() => setDisplay("tableau")}
              >
                Tableau
              </Button>
            </div>
            <Button onClick={startCreate}>+ Nouveau créneau</Button>
          </div>
        )}
      </div>

      {!groupeId ? (
        <p className="text-sm text-muted-foreground">
          Choisissez une classe pour voir et modifier son emploi du temps.
        </p>
      ) : (
        <>
          <FormDialog
            open={showForm}
            onOpenChange={setShowForm}
            title={editingId ? "Modifier le créneau" : "Nouveau créneau"}
          >
            <Formik
              key={editingId ?? "create"}
              initialValues={initialValues}
              validationSchema={EntrySchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting }) => (
                <Form className="space-y-4" noValidate>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <SelectField
                      name="day"
                      label="Jour"
                      options={TIMETABLE_DAYS.map((d) => ({
                        value: d,
                        label: d,
                      }))}
                      placeholder="Choisir…"
                    />
                    <TextInputField
                      name="startTime"
                      label="Début"
                      type="time"
                    />
                    <TextInputField name="endTime" label="Fin" type="time" />
                    <TextInputField
                      name="subjectName"
                      label="Matière"
                      placeholder="ex : Mathématiques"
                      list="timetable-subject-names"
                    />
                    <TextInputField
                      name="teacherName"
                      label="Enseignant"
                      placeholder="ex : Nom Prénom"
                      wrapperClassName="col-span-2"
                      list="timetable-staff-names"
                      disabled={Boolean(ownTeacherName)}
                    />
                    <SelectField
                      name="salleId"
                      label="Salle"
                      clearable
                      clearLabel="Aucune salle"
                      placeholder="Choisir une salle…"
                      options={salles.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                    />
                  </div>
                  {/* Suggestions natives (`<datalist>`) plutôt qu'un SelectField : les
                      deux champs restent du texte libre (voir timetable.schema.ts),
                      un enseignant ou intervenant ponctuel non inscrit au registre
                      du personnel doit pouvoir être saisi quand même. */}
                  <datalist id="timetable-subject-names">
                    {subjectNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  <datalist id="timetable-staff-names">
                    {staffNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting
                        ? "Enregistrement…"
                        : editingId
                          ? "Enregistrer"
                          : "Ajouter"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </Form>
              )}
            </Formik>
          </FormDialog>

          {display === "liste" ? (
            <DataTable
              columns={columns}
              data={entries}
              rowKey={(e) => e.id}
              loading={entriesQuery.isLoading}
              emptyMessage="Aucun créneau pour cette classe."
              pageSize={50}
              rowActions={(e) => {
                // Itération 29 — un compte Enseignant scopé ne peut modifier/
                // supprimer que ses PROPRES créneaux (le backend le refuserait
                // de toute façon, voir assertOwnTimetableEntry ; on évite ici
                // de proposer une action vouée à échouer).
                if (scope?.restricted && e.teacherId !== scope.staffMemberId)
                  return null;
                return (
                  <>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => startEdit(e)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 pl-3 text-destructive"
                      onClick={() => setPendingDeleteId(e.id)}
                    >
                      Supprimer
                    </Button>
                  </>
                );
              }}
            />
          ) : entriesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <TimetableGrid
              entries={entries}
              renderCell={(e) => (
                <div className="space-y-0.5">
                  <div className="font-medium leading-tight">
                    {e.subjectName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  {e.teacherName && (
                    <div className="text-xs leading-tight text-muted-foreground">
                      {e.teacherName}
                    </div>
                  )}
                  {e.salle?.name && (
                    <div className="text-xs leading-tight text-muted-foreground">
                      {e.salle.name}
                    </div>
                  )}
                  {(!scope?.restricted ||
                    e.teacherId === scope.staffMemberId) && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => startEdit(e)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => setPendingDeleteId(e.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              )}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer ce créneau ?"
        description={
          pendingEntry ? (
            <>
              Le créneau {pendingEntry.day} {pendingEntry.startTime}–
              {pendingEntry.endTime}
              {pendingEntry.subjectName
                ? ` (${pendingEntry.subjectName})`
                : ""}{" "}
              sera définitivement supprimé.
            </>
          ) : (
            "Cette action est irréversible."
          )
        }
        onConfirm={confirmDelete}
        loading={deleteEntry.isPending}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Vue "Par enseignant" — recherche du planning complet d'un enseignant sur
// toutes les classes de l'école, appuyée sur le filtre `teacherName` côté
// serveur (recherche insensible à la casse, voir timetable.service.ts).
// ----------------------------------------------------------------------------

function TimetableByTeacher({
  schoolId,
  groupes,
  classes,
  series,
}: {
  schoolId: string;
  groupes: {
    id: string;
    name: string;
    classeId: string;
    serieId?: string | null;
  }[];
  classes: Pick<Classe, "id" | "name">[];
  series: Pick<Serie, "id" | "name">[];
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [display, setDisplay] = useState<"liste" | "tableau">("liste");

  const entriesQuery = useTimetableQuery(schoolId, {
    teacherName: debouncedSearch || undefined,
  });
  const deleteEntry = useDeleteTimetableEntryMutation(schoolId);

  const entries = debouncedSearch ? (entriesQuery.data ?? []) : [];

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteEntry.mutateAsync(pendingDeleteId);
      toast.success("Créneau supprimé.");
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const columns: DataTableColumn<TimetableEntry>[] = [
    { header: "Jour", cell: (e) => <Badge variant="outline">{e.day}</Badge> },
    { header: "Horaire", cell: (e) => `${e.startTime} – ${e.endTime}` },
    {
      header: "Classe",
      cell: (e) =>
        groupeLabelById(e.groupeId, groupes, classes, series, e.groupe.name),
    },
    {
      header: "Matière",
      cell: (e) =>
        e.subjectName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Salle",
      cell: (e) =>
        e.salle?.name ?? <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground">Enseignant</Label>
          <Input
            placeholder="Rechercher un nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {debouncedSearch && (
          <div className="flex gap-2">
            <Button
              variant={display === "liste" ? "default" : "outline"}
              size="sm"
              onClick={() => setDisplay("liste")}
            >
              Liste
            </Button>
            <Button
              variant={display === "tableau" ? "default" : "outline"}
              size="sm"
              onClick={() => setDisplay("tableau")}
            >
              Tableau
            </Button>
          </div>
        )}
      </div>

      {!debouncedSearch ? (
        <p className="text-sm text-muted-foreground">
          Saisissez un nom d'enseignant pour voir son planning sur toutes les
          classes.
        </p>
      ) : display === "liste" ? (
        <DataTable
          columns={columns}
          data={entries}
          rowKey={(e) => e.id}
          loading={entriesQuery.isLoading}
          emptyMessage="Aucun créneau trouvé pour cet enseignant."
          pageSize={50}
          rowActions={(e) => (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-destructive"
              onClick={() => setPendingDeleteId(e.id)}
            >
              Supprimer
            </Button>
          )}
        />
      ) : entriesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <TimetableGrid
          entries={entries}
          renderCell={(e) => (
            <div className="space-y-0.5">
              <div className="font-medium leading-tight">
                {groupeLabelById(
                  e.groupeId,
                  groupes,
                  classes,
                  series,
                  e.groupe.name,
                )}
              </div>
              {e.subjectName && (
                <div className="text-xs leading-tight text-muted-foreground">
                  {e.subjectName}
                </div>
              )}
              {e.salle?.name && (
                <div className="text-xs leading-tight text-muted-foreground">
                  {e.salle.name}
                </div>
              )}
              <div className="pt-1">
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => setPendingDeleteId(e.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
        />
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer ce créneau ?"
        description="Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={deleteEntry.isPending}
      />
    </div>
  );
}
