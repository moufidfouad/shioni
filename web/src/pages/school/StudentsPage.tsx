import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { Student, TeachingScope } from "../../types";
import { SchoolOutletContext } from "../../layouts/SchoolLayout";
import { useSchoolParametersQuery } from "../../features/parameters/api";
import { useMyTeachingScopeQuery } from "../../features/me/api";
import {
  studentPhotoUrl,
  useCreateStudentMutation,
  useDeleteStudentMutation,
  useDeleteStudentPhotoMutation,
  useStudentsQuery,
  useStudentStatsQuery,
  useUpdateStudentMutation,
  useUploadStudentPhotoMutation,
} from "../../features/students/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSearchParamsState } from "../../hooks/useSearchParamsState";
import StatCard from "../../components/StatCard";
import { SkeletonStatCard } from "../../components/Skeleton";
import PageHeader from "../../components/PageHeader";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import FormDialog from "../../components/FormDialog";
import PhotoManagerDialog from "../../components/PhotoManagerDialog";
import ErrorState from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextInputField, SelectField, DateField } from "@/components/form";
import PageTransition from "@/components/motion/PageTransition";
import { groupeLabel, groupeLabelById } from "@/lib/groupeLabel";

interface StudentFormValues {
  fullName: string;
  birthDate: string;
  birthPlace: string;
  sex: "" | "M" | "F";
  parentName: string;
  parentPhone: string;
  // Itération 46 — voir le commentaire sur Student.nationalIdNumber/
  // ministryStudentNumber (types/index.ts) : identifiants externes
  // optionnels, uniques par école, qui permettent de retrouver le parcours
  // de cet élève dans d'autres écoles (voir StudentNetworkPage.tsx).
  nationalIdNumber: string;
  ministryStudentNumber: string;
  groupeId: string;
}

const emptyValues: StudentFormValues = {
  fullName: "",
  birthDate: "",
  birthPlace: "",
  sex: "",
  parentName: "",
  parentPhone: "",
  nationalIdNumber: "",
  ministryStudentNumber: "",
  groupeId: "",
};

const ALL_VALUE = "__all__";

// Itération 32 — un compte ENSEIGNANT restreint (voir useMyTeachingScopeQuery,
// même patron que AttendancePage.tsx) ne doit voir que les élèves de ses
// propres classes ; le sélecteur de classe est filtré en conséquence.
function filterGroupesByScope<T extends { id: string }>(groupes: T[], scope?: TeachingScope): T[] {
  if (!scope || !scope.restricted) return groupes;
  const allowed = new Set(scope.groupeIds);
  return groupes.filter((c) => allowed.has(c.id));
}

const StudentSchema = Yup.object({
  fullName: Yup.string().trim().min(2, "2 caractères minimum").required("Le nom & prénom sont requis."),
  birthDate: Yup.string().optional(),
  birthPlace: Yup.string().optional(),
  sex: Yup.mixed<"" | "M" | "F">().oneOf(["", "M", "F"]).optional(),
  parentName: Yup.string().optional(),
  parentPhone: Yup.string().optional(),
  nationalIdNumber: Yup.string().trim().max(50, "50 caractères maximum").optional(),
  ministryStudentNumber: Yup.string().trim().max(50, "50 caractères maximum").optional(),
  groupeId: Yup.string().optional(),
});

// Reflète la feuille "ELEVES" : registre des élèves avec matricule
// auto-généré, cartes de stats en tête, filtres (recherche, classe, sexe) et
// formulaire de création/édition (Formik + Yup), la liste étant rendue via
// le composant DataTable partagé (pagination client). Filtres et données
// passent par React Query (`useStudentsQuery`) — le filtre "classe"
// existait déjà côté API, "sexe" a été ajouté pour cette itération ; les
// deux sont envoyés au serveur, avec la recherche texte (`search`, débattue
// via `useDebouncedValue`) plutôt que filtrés côté client.
export default function Students() {
  const { school } = useOutletContext<SchoolOutletContext>();
  // Étape 4, Vague 1 — filtres synchronisés à l'URL (`?q=&classe=&sexe=`) au
  // lieu d'un simple `useState` : survivent au rechargement/retour arrière
  // et rendent cette page partageable par lien (audit §5 point 3).
  const [search, setSearch] = useSearchParamsState("q");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [groupeFilter, setGroupeFilter] = useSearchParamsState("classe");
  const [sexFilterRaw, setSexFilter] = useSearchParamsState("sexe");
  const sexFilter = sexFilterRaw as "" | "M" | "F";
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const studentsQuery = useStudentsQuery(
    school.id,
    {
      search: debouncedSearch || undefined,
      groupeId: groupeFilter || undefined,
      sex: sexFilter || undefined,
    },
    { page, pageSize }
  );

  // Retour à la page 1 dès qu'un filtre change, pour ne jamais se retrouver
  // sur une page devenue vide (même principe que l'ancienne pagination
  // client de DataTable, reproduit ici côté serveur).
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, groupeFilter, sexFilter]);
  const scopeQuery = useMyTeachingScopeQuery(school.id);
  const restricted = Boolean(scopeQuery.data?.restricted);
  // GET /stats reste réservé à ADMIN/GESTION_ELEVES côté backend — inutile
  // (et refusé) pour un compte Enseignant scopé.
  //
  // Correctif Étape 4, Vague 1 (itération 54) — `enabled: !restricted` seul
  // se rouvrait au tout premier rendu : tant que `scopeQuery` n'a pas
  // résolu, `scopeQuery.data` vaut `undefined`, donc `restricted` vaut
  // `false` et la requête stats partait quand même pour un compte
  // Enseignant restreint, avant d'être coupée une fois le scope connu —
  // même bug de gate que celui corrigé sur `dashboardQuery` dans
  // SchoolLayout.tsx en itération 53. `scopeQuery.isSuccess` referme la
  // fenêtre.
  const statsQuery = useStudentStatsQuery(school.id, scopeQuery.isSuccess && !restricted);
  const parametersQuery = useSchoolParametersQuery(school.id);
  const createStudent = useCreateStudentMutation(school.id);
  const updateStudent = useUpdateStudentMutation(school.id);
  const deleteStudent = useDeleteStudentMutation(school.id);
  const uploadStudentPhoto = useUploadStudentPhotoMutation(school.id);
  const deleteStudentPhoto = useDeleteStudentPhotoMutation(school.id);

  const students = studentsQuery.data?.data ?? [];
  const pagination = studentsQuery.data?.pagination;
  const stats = statsQuery.data ?? null;
  const groupes = filterGroupesByScope(parametersQuery.data?.groupes ?? [], scopeQuery.data);
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<StudentFormValues>(emptyValues);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Itération 64 — photo d'identité : id de l'élève dont le dialogue photo
  // est ouvert, `null` sinon (même patron que `pendingDeleteId` ci-dessus).
  const [photoStudentId, setPhotoStudentId] = useState<string | null>(null);
  const photoStudent = students.find((s) => s.id === photoStudentId) ?? null;

  function startCreate() {
    setEditingId(null);
    setInitialValues(emptyValues);
    setShowForm(true);
  }

  function startEdit(student: Student) {
    setEditingId(student.id);
    setInitialValues({
      fullName: student.fullName,
      birthDate: student.birthDate ? student.birthDate.slice(0, 10) : "",
      birthPlace: student.birthPlace || "",
      sex: (student.sex as "M" | "F") || "",
      parentName: student.parentName || "",
      parentPhone: student.parentPhone || "",
      nationalIdNumber: student.nationalIdNumber || "",
      ministryStudentNumber: student.ministryStudentNumber || "",
      groupeId: student.groupeId || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(values: StudentFormValues, helpers: FormikHelpers<StudentFormValues>) {
    const payload = { ...values, sex: values.sex || undefined, groupeId: values.groupeId || undefined };
    try {
      if (editingId) {
        await updateStudent.mutateAsync({ id: editingId, payload });
        toast.success("Élève mis à jour.");
      } else {
        await createStudent.mutateAsync(payload);
        toast.success("Élève créé.");
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
      await deleteStudent.mutateAsync(pendingDeleteId);
      toast.success("Élève supprimé.");
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const columns: DataTableColumn<Student>[] = [
    {
      header: "",
      cell: (s) =>
        s.hasPhoto ? (
          <img
            src={studentPhotoUrl(school.id, s.id)}
            alt={s.fullName}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
          </div>
        ),
    },
    { header: "Matricule", cell: (s) => <span className="font-mono text-xs text-muted-foreground">{s.matricule}</span> },
    { header: "Nom & prénom", cell: (s) => <span className="font-medium">{s.fullName}</span> },
    { header: "Âge", cell: (s) => s.age ?? "—" },
    { header: "Classe", cell: (s) => groupeLabelById(s.groupeId, groupes, classes, series, s.groupe?.name) },
    { header: "Parent", cell: (s) => <span className="text-muted-foreground">{s.parentName ?? "—"}</span> },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Élèves"
        description={school.name}
        actions={!restricted ? <Button onClick={startCreate}>+ Nouvel élève</Button> : undefined}
      />

      {!restricted &&
        (statsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </div>
        ) : (
          stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <StatCard label="Élèves inscrits" value={stats.total} />
              <StatCard label="Garçons" value={stats.boys} />
              <StatCard label="Filles" value={stats.girls} />
              <StatCard label="Âge moyen" value={stats.averageAge ?? "—"} />
              <StatCard label="Nb classes" value={stats.classCount} />
            </div>
          )
        ))}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher un élève…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select value={groupeFilter || ALL_VALUE} onValueChange={(v) => setGroupeFilter(v === ALL_VALUE ? "" : v)}>
          <SelectTrigger className="w-44" aria-label="Filtrer par classe">
            <SelectValue placeholder="Toutes les classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Toutes les classes</SelectItem>
            {groupes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {groupeLabel(c, classes, series)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sexFilter || ALL_VALUE} onValueChange={(v) => setSexFilter(v === ALL_VALUE ? "" : (v as "M" | "F"))}>
          <SelectTrigger className="w-36" aria-label="Filtrer par sexe">
            <SelectValue placeholder="Sexe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous</SelectItem>
            <SelectItem value="M">Masculin</SelectItem>
            <SelectItem value="F">Féminin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FormDialog
        open={!restricted && showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier l'élève" : "Nouvel élève"}
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={initialValues}
          validationSchema={StudentSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <TextInputField name="fullName" label="Nom & prénom" wrapperClassName="col-span-2" />
                <SelectField
                  name="sex"
                  label="Sexe"
                  clearable
                  placeholder="—"
                  options={[
                    { value: "M", label: "Masculin" },
                    { value: "F", label: "Féminin" },
                  ]}
                />
                <DateField name="birthDate" label="Date de naissance" />
                <TextInputField name="birthPlace" label="Lieu de naissance" />
                <SelectField
                  name="groupeId"
                  label="Classe"
                  clearable
                  placeholder="—"
                  searchPlaceholder="Rechercher une classe…"
                  options={groupes.map((c) => ({ value: c.id, label: groupeLabel(c, classes, series) }))}
                />
                <TextInputField name="parentName" label="Nom du parent / tuteur" />
                <TextInputField name="parentPhone" label="Téléphone du parent" />
                <TextInputField name="nationalIdNumber" label="N° carte d'identité nationale" />
                <TextInputField name="ministryStudentNumber" label="N° d'élève (ministère)" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enregistrement…" : editingId ? "Enregistrer" : "Créer"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </FormDialog>

      {studentsQuery.isError ? (
        <ErrorState onRetry={() => studentsQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={students}
          rowKey={(s) => s.id}
          loading={studentsQuery.isLoading}
          emptyMessage="Aucun élève ne correspond à ces filtres."
          serverPagination={
            pagination
              ? { page: pagination.page, pageSize: pagination.pageSize, total: pagination.total, onPageChange: setPage }
              : undefined
          }
          rowActions={
            restricted
              ? undefined
              : (s) => (
                  // Itération 108 — constat Lighthouse "Accessibilité" (itération 60) :
                  // cibles tactiles trop petites sur Élèves. `h-auto p-0` réduisait
                  // la zone cliquable de ces liens au seul empattement du texte
                  // (quelques px de haut) ; la taille "sm" par défaut du composant
                  // Button (h-8 px-3, déjà utilisée ailleurs dans l'appli) donne une
                  // cible d'environ 32px de haut avec un espacement horizontal net
                  // entre les trois actions, tout en gardant l'apparence de lien
                  // (variant="link" reste sans fond ni bordure).
                  <>
                    <Button variant="link" size="sm" onClick={() => startEdit(s)}>
                      Modifier
                    </Button>
                    <Button variant="link" size="sm" onClick={() => setPhotoStudentId(s.id)}>
                      Photo
                    </Button>
                    <Button variant="link" size="sm" className="text-destructive" onClick={() => setPendingDeleteId(s.id)}>
                      Supprimer
                    </Button>
                  </>
                )
          }
        />
      )}

      {!restricted && (
        <ConfirmDialog
          open={pendingDeleteId !== null}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          title="Supprimer cet élève ?"
          description={
            <>
              {students.find((s) => s.id === pendingDeleteId)?.fullName ?? "Cet élève"} sera définitivement supprimé,
              avec son historique associé. Cette action est irréversible.
            </>
          }
          onConfirm={confirmDelete}
          loading={deleteStudent.isPending}
        />
      )}

      {!restricted && photoStudent && (
        <PhotoManagerDialog
          open={photoStudentId !== null}
          onOpenChange={(open) => !open && setPhotoStudentId(null)}
          title={`Photo — ${photoStudent.fullName}`}
          entityLabel={photoStudent.fullName}
          photoUrl={photoStudent.hasPhoto ? studentPhotoUrl(school.id, photoStudent.id) : null}
          onUpload={(file, onProgress) =>
            uploadStudentPhoto.mutateAsync({ studentId: photoStudent.id, file, onUploadProgress: onProgress })
          }
          onDelete={() => deleteStudentPhoto.mutateAsync(photoStudent.id)}
        />
      )}
    </PageTransition>
  );
}
