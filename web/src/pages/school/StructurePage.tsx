import { Formik, Form } from "formik";
import * as Yup from "yup";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import {
  Classe,
  Cycle,
  Groupe,
  SALLE_TYPES,
  Salle,
  SchoolYear,
  Serie,
} from "@/types";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import {
  useDeleteClasseMutation,
  useDeleteCycleMutation,
  useDeleteGroupeMutation,
  useDeleteSalleMutation,
  useDeleteSchoolYearMutation,
  useDeleteSerieMutation,
  useSchoolParametersQuery,
  useSetCurrentSchoolYearMutation,
  useUpsertClasseMutation,
  useUpsertCycleMutation,
  useUpsertGroupeMutation,
  useUpsertSalleMutation,
  useUpsertSchoolYearMutation,
  useUpsertSerieMutation,
} from "@/features/parameters/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextInputField, SelectField } from "@/components/form";
import ConfirmDialog from "@/components/ConfirmDialog";
import FormDialog from "@/components/FormDialog";
import PageHeader from "@/components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import ErrorState from "@/components/ErrorState";
import { useCrudTab } from "@/providers/hooks/useCrudTab";


function nameOf<T extends { id: string; name: string }>(
  list: T[],
  id: string | null | undefined,
): string {
  if (!id) return "—";
  return list.find((x) => x.id === id)?.name ?? "?";
}

// ----------------------------------------------------------------------------
// CYCLES
// ----------------------------------------------------------------------------

interface CycleValues {
  name: string;
  order: string;
}
const emptyCycle: CycleValues = { name: "", order: "" };
const CycleSchema = Yup.object({
  name: Yup.string().trim().min(1, "Requis.").required("Le nom est requis."),
  order: Yup.number().typeError("Nombre requis.").optional(),
});

function CyclesTab({
  schoolId,
  cycles,
}: {
  schoolId: string;
  cycles: Cycle[];
}) {
  const upsert = useUpsertCycleMutation(schoolId);
  const del = useDeleteCycleMutation(schoolId);

  const {
    showForm,
    setShowForm,
    editingId,
    values,
    pendingDelete,
    setPendingDelete,
    startCreate,
    startEdit,
    handleSubmit,
    confirmDelete,
  } = useCrudTab<
    Cycle,
    CycleValues,
    { id?: string; name: string; order?: number }
  >({
    emptyValues: emptyCycle,
    toFormValues: (c) => ({ name: c.name, order: String(c.order) }),
    toPayload: (v, editingId) => ({
      id: editingId ?? undefined,
      name: v.name,
      order: v.order ? Number(v.order) : undefined,
    }),
    upsert,
    del,
    labels: {
      createSuccess: "Cycle ajouté.",
      updateSuccess: "Cycle mis à jour.",
      deleteSuccess: "Cycle supprimé.",
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Primaire, Collège, Lycée — l'organisation par cycle de cette école.
          </p>
          <Button size="sm" onClick={startCreate}>
            + Nouveau cycle
          </Button>
        </div>
        <ul className="divide-y">
          {cycles.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>{c.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">ordre {c.order}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => startEdit(c)}
                >
                  Modifier
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setPendingDelete(c.id)}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
          {cycles.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              Aucun cycle pour l'instant.
            </li>
          )}
        </ul>
      </CardContent>
      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier le cycle" : "Nouveau cycle"}
        description={
          editingId
            ? `Modification de « ${nameOf(cycles, editingId)} ».`
            : undefined
        }
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={values}
          validationSchema={CycleSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <TextInputField
                name="name"
                label="Nom"
                placeholder="ex: Collège"
              />
              <TextInputField
                name="order"
                type="number"
                label="Ordre d'affichage"
              />
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
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer ce cycle ?"
        description="Toutes les classes, séries et groupes de ce cycle seront également supprimés. Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
// CLASSES
// ----------------------------------------------------------------------------

interface ClasseValues {
  cycleId: string;
  name: string;
  order: string;
}
const emptyClasse: ClasseValues = { cycleId: "", name: "", order: "" };
const ClasseSchema = Yup.object({
  cycleId: Yup.string().required("Le cycle est requis."),
  name: Yup.string().trim().min(1, "Requis.").required("Le nom est requis."),
  order: Yup.number().typeError("Nombre requis.").optional(),
});

function ClassesTab({
  schoolId,
  cycles,
  classes,
}: {
  schoolId: string;
  cycles: Cycle[];
  classes: Classe[];
}) {
  const upsert = useUpsertClasseMutation(schoolId);
  const del = useDeleteClasseMutation(schoolId);

  const {
    showForm,
    setShowForm,
    editingId,
    values,
    pendingDelete,
    setPendingDelete,
    startCreate,
    startEdit,
    handleSubmit,
    confirmDelete,
  } = useCrudTab<
    Classe,
    ClasseValues,
    { id?: string; cycleId: string; name: string; order?: number }
  >({
    emptyValues: emptyClasse,
    toFormValues: (c) => ({
      cycleId: c.cycleId,
      name: c.name,
      order: String(c.order),
    }),
    toPayload: (v, editingId) => ({
      id: editingId ?? undefined,
      cycleId: v.cycleId,
      name: v.name,
      order: v.order ? Number(v.order) : undefined,
    }),
    upsert,
    del,
    labels: {
      createSuccess: "Classe ajoutée.",
      updateSuccess: "Classe mise à jour.",
      deleteSuccess: "Classe supprimée.",
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Le niveau (ex "6ème", "Seconde"), rattaché à un cycle.
          </p>
          <Button size="sm" onClick={startCreate}>
            + Nouvelle classe
          </Button>
        </div>
        <ul className="divide-y">
          {classes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>
                {c.name}{" "}
                <span className="text-muted-foreground">
                  — {nameOf(cycles, c.cycleId)}
                </span>
              </span>
              <div className="flex items-center gap-3">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => startEdit(c)}
                >
                  Modifier
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setPendingDelete(c.id)}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
          {classes.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              Aucune classe pour l'instant.
            </li>
          )}
        </ul>
      </CardContent>
      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier la classe" : "Nouvelle classe"}
        description={
          editingId
            ? `Modification de « ${nameOf(classes, editingId)} ».`
            : undefined
        }
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={values}
          validationSchema={ClasseSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <SelectField
                name="cycleId"
                label="Cycle"
                placeholder="Choisir un cycle"
                options={cycles.map((c) => ({ value: c.id, label: c.name }))}
              />
              <TextInputField name="name" label="Nom" placeholder="ex: 6ème" />
              <TextInputField name="order" type="number" label="Ordre" />
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
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer cette classe ?"
        description="Ses séries, groupes et son tarif de frais scolaires seront également supprimés. Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
// SÉRIES
// ----------------------------------------------------------------------------

interface SerieValues {
  classeId: string;
  name: string;
  order: string;
}
const emptySerie: SerieValues = { classeId: "", name: "", order: "" };
const SerieSchema = Yup.object({
  classeId: Yup.string().required("La classe est requise."),
  name: Yup.string().trim().min(1, "Requis.").required("Le nom est requis."),
  order: Yup.number().typeError("Nombre requis.").optional(),
});

function SeriesTab({
  schoolId,
  classes,
  series,
}: {
  schoolId: string;
  classes: Classe[];
  series: Serie[];
}) {
  const upsert = useUpsertSerieMutation(schoolId);
  const del = useDeleteSerieMutation(schoolId);
  // Itération 56 (Étape 4, Vague 3) — troisième onglet migré vers `useCrudTab`.
  const {
    showForm,
    setShowForm,
    editingId,
    values,
    pendingDelete,
    setPendingDelete,
    startCreate,
    startEdit,
    handleSubmit,
    confirmDelete,
  } = useCrudTab<
    Serie,
    SerieValues,
    { id?: string; classeId: string; name: string; order?: number }
  >({
    emptyValues: emptySerie,
    toFormValues: (s) => ({
      classeId: s.classeId,
      name: s.name,
      order: String(s.order),
    }),
    toPayload: (v, editingId) => ({
      id: editingId ?? undefined,
      classeId: v.classeId,
      name: v.name,
      order: v.order ? Number(v.order) : undefined,
    }),
    upsert,
    del,
    labels: {
      createSuccess: "Série ajoutée.",
      updateSuccess: "Série mise à jour.",
      deleteSuccess: "Série supprimée.",
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Ex "Seconde L", "Seconde G", "Première S" — optionnelle : une classe
            n'en a pas forcément.
          </p>
          <Button size="sm" onClick={startCreate}>
            + Nouvelle série
          </Button>
        </div>
        <ul className="divide-y">
          {series.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>
                {nameOf(classes, s.classeId)} {s.name}
              </span>
              <div className="flex items-center gap-3">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => startEdit(s)}
                >
                  Modifier
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setPendingDelete(s.id)}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
          {series.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              Aucune série pour l'instant.
            </li>
          )}
        </ul>
      </CardContent>
      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier la série" : "Nouvelle série"}
        description={
          editingId
            ? `Modification de « ${nameOf(classes, series.find((s) => s.id === editingId)?.classeId)} ${series.find((s) => s.id === editingId)?.name} ».`
            : undefined
        }
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={values}
          validationSchema={SerieSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <SelectField
                name="classeId"
                label="Classe"
                placeholder="Choisir une classe"
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
              <TextInputField
                name="name"
                label="Code"
                placeholder="ex: L, G, S"
              />
              <TextInputField name="order" type="number" label="Ordre" />
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
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer cette série ?"
        description="Ses groupes seront également supprimés. Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
// GROUPES
// ----------------------------------------------------------------------------

interface GroupeValues {
  classeId: string;
  serieId: string;
  name: string;
  targetSize: string;
}
const emptyGroupe: GroupeValues = {
  classeId: "",
  serieId: "",
  name: "",
  targetSize: "",
};
const GroupeSchema = Yup.object({
  classeId: Yup.string().required("La classe est requise."),
  serieId: Yup.string().optional(),
  name: Yup.string().trim().min(1, "Requis.").required("Le nom est requis."),
  targetSize: Yup.number()
    .typeError("Nombre requis.")
    .min(0, "Doit être positif.")
    .optional(),
});

function GroupesTab({
  schoolId,
  classes,
  series,
  groupes,
}: {
  schoolId: string;
  classes: Classe[];
  series: Serie[];
  groupes: Groupe[];
}) {
  const upsert = useUpsertGroupeMutation(schoolId);
  const del = useDeleteGroupeMutation(schoolId);

  function labelFor(g: Groupe) {
    const classeName = nameOf(classes, g.classeId);
    const serieName = g.serieId
      ? ` ${series.find((s) => s.id === g.serieId)?.name ?? "?"}`
      : "";
    return `${classeName}${serieName} ${g.name}`;
  }

  // Itération 56 (Étape 4, Vague 3) — quatrième onglet migré vers
  // `useCrudTab`. Seule subtilité par rapport aux onglets déjà migrés :
  // `serieId` est optionnel des deux côtés (`v.serieId || null` en écriture,
  // `g.serieId ?? ""` en lecture) — comportement inchangé.
  const {
    showForm,
    setShowForm,
    editingId,
    values,
    pendingDelete,
    setPendingDelete,
    startCreate,
    startEdit,
    handleSubmit,
    confirmDelete,
  } = useCrudTab<
    Groupe,
    GroupeValues,
    {
      id?: string;
      classeId: string;
      serieId: string | null;
      name: string;
      targetSize?: number;
    }
  >({
    emptyValues: emptyGroupe,
    toFormValues: (g) => ({
      classeId: g.classeId,
      serieId: g.serieId ?? "",
      name: g.name,
      targetSize: g.targetSize != null ? String(g.targetSize) : "",
    }),
    toPayload: (v, editingId) => ({
      id: editingId ?? undefined,
      classeId: v.classeId,
      serieId: v.serieId || null,
      name: v.name,
      targetSize: v.targetSize ? Number(v.targetSize) : undefined,
    }),
    upsert,
    del,
    labels: {
      createSuccess: "Groupe ajouté.",
      updateSuccess: "Groupe mis à jour.",
      deleteSuccess: "Groupe supprimé.",
    },
  });

  const seriesForSelectedClasse = series.filter(
    (s) => s.classeId === values.classeId,
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            La section concrète affectée aux élèves (ex "4ème A", "4ème B") —
            subdivise une classe, ou une série de la classe.
          </p>
          <Button size="sm" onClick={startCreate}>
            + Nouveau groupe
          </Button>
        </div>
        <ul className="divide-y">
          {groupes.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>{labelFor(g)}</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {g.targetSize ?? "—"} élèves visés
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => startEdit(g)}
                >
                  Modifier
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setPendingDelete(g.id)}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
          {groupes.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              Aucun groupe pour l'instant.
            </li>
          )}
        </ul>
      </CardContent>
      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier le groupe" : "Nouveau groupe"}
        description={
          editingId ? "Modification d'un groupe existant." : undefined
        }
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={values}
          validationSchema={GroupeSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting, values: formValues }) => (
            <Form className="space-y-4" noValidate>
              <SelectField
                name="classeId"
                label="Classe"
                placeholder="Choisir une classe"
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
              <SelectField
                name="serieId"
                label="Série (optionnelle)"
                placeholder="Série (optionnelle)"
                clearable
                options={series
                  .filter((s) => s.classeId === formValues.classeId)
                  .map((s) => ({ value: s.id, label: s.name }))}
                key={formValues.classeId}
              />
              <TextInputField name="name" label="Nom" placeholder="ex: A" />
              <TextInputField
                name="targetSize"
                type="number"
                label="Effectif cible"
              />
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
        {seriesForSelectedClasse.length === 0 && values.classeId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Cette classe n'a aucune série : le groupe la subdivisera
            directement.
          </p>
        )}
      </FormDialog>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer ce groupe ?"
        description="Les élèves de ce groupe seront désaffectés (plus aucun groupe), sans être supprimés. Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
// SALLES
// ----------------------------------------------------------------------------

interface SalleValues {
  name: string;
  capacity: string;
  type: string;
}
const emptySalle: SalleValues = { name: "", capacity: "", type: "" };
const SalleSchema = Yup.object({
  name: Yup.string().trim().min(1, "Requis.").required("Le nom est requis."),
  capacity: Yup.number()
    .typeError("Nombre requis.")
    .min(0, "Doit être positif.")
    .optional(),
  type: Yup.string().optional(),
});

function SallesTab({
  schoolId,
  salles,
}: {
  schoolId: string;
  salles: Salle[];
}) {
  const upsert = useUpsertSalleMutation(schoolId);
  const del = useDeleteSalleMutation(schoolId);
  // Itération 56 (Étape 4, Vague 3) — cinquième onglet migré vers `useCrudTab`.
  const {
    showForm,
    setShowForm,
    editingId,
    values,
    pendingDelete,
    setPendingDelete,
    startCreate,
    startEdit,
    handleSubmit,
    confirmDelete,
  } = useCrudTab<
    Salle,
    SalleValues,
    { id?: string; name: string; capacity?: number; type?: string }
  >({
    emptyValues: emptySalle,
    toFormValues: (s) => ({
      name: s.name,
      capacity: s.capacity != null ? String(s.capacity) : "",
      type: s.type ?? "",
    }),
    toPayload: (v, editingId) => ({
      id: editingId ?? undefined,
      name: v.name,
      capacity: v.capacity ? Number(v.capacity) : undefined,
      type: v.type || undefined,
    }),
    upsert,
    del,
    labels: {
      createSuccess: "Salle ajoutée.",
      updateSuccess: "Salle mise à jour.",
      deleteSuccess: "Salle supprimée.",
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Locaux physiques réutilisés dans l'emploi du temps — indépendants
            des classes/groupes.
          </p>
          <Button size="sm" onClick={startCreate}>
            + Nouvelle salle
          </Button>
        </div>
        <ul className="divide-y">
          {salles.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>
                {s.name}{" "}
                {s.type && (
                  <span className="text-muted-foreground">— {s.type}</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {s.capacity ?? "—"} places
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => startEdit(s)}
                >
                  Modifier
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setPendingDelete(s.id)}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
          {salles.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              Aucune salle pour l'instant.
            </li>
          )}
        </ul>
      </CardContent>
      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier la salle" : "Nouvelle salle"}
        description={
          editingId
            ? `Modification de « ${nameOf(salles, editingId)} ».`
            : undefined
        }
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={values}
          validationSchema={SalleSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <TextInputField
                name="name"
                label="Nom"
                placeholder="ex: Salle 1"
              />
              <TextInputField name="capacity" type="number" label="Capacité" />
              <TextInputField
                name="type"
                label="Type"
                placeholder="ex: Standard"
                list="salle-types"
              />
              <datalist id="salle-types">
                {SALLE_TYPES.map((t) => (
                  <option key={t} value={t} />
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
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer cette salle ?"
        description="Les créneaux d'emploi du temps qui l'utilisent perdront simplement leur salle assignée. Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
// ANNÉES SCOLAIRES (itération 44 — demande utilisateur explicite : "côté
// front, les années scolaires doivent être sélectionnées sur combo et non
// écrits sur input, avec une interface de gestion des années scolaires où on
// peut ajouter ou modifier"). Même patron que les cinq onglets ci-dessus,
// avec une action en plus, propre à cette entité : "définir comme courante"
// (`School.currentSchoolYearId`, remplace l'ancien champ texte libre de
// SchoolSettingsPage). Suppression protégée côté backend (`onDelete:
// Restrict` + vérification service, voir schema.prisma::SchoolYear) —
// contrairement à un Cycle/une Classe, dont la suppression cascade
// volontairement jusqu'aux Groupes/FeeLevel qui en dépendent : une année
// scolaire référencée par de VRAIES données financières (inscriptions,
// écolage) ou une décision de fin d'année ne peut pas disparaître en
// silence.
// ----------------------------------------------------------------------------

interface SchoolYearValues {
  label: string;
  order: string;
}
const emptySchoolYear: SchoolYearValues = { label: "", order: "" };
const SchoolYearSchema = Yup.object({
  label: Yup.string()
    .trim()
    .min(1, "Requis.")
    .required("Le libellé est requis."),
  order: Yup.number().typeError("Nombre requis.").optional(),
});

function SchoolYearsTab({
  schoolId,
  schoolYears,
  currentSchoolYearId,
}: {
  schoolId: string;
  schoolYears: SchoolYear[];
  currentSchoolYearId: string | null;
}) {
  const upsert = useUpsertSchoolYearMutation(schoolId);
  const del = useDeleteSchoolYearMutation(schoolId);
  const setCurrent = useSetCurrentSchoolYearMutation(schoolId);
  // Itération 56 (Étape 4, Vague 3) — sixième et dernier onglet migré vers
  // `useCrudTab`, referme les 13 `any` documentés par l'audit (§3/§4.4 :
  // c'étaient exactement les 13 blocs `catch (err: any)` de ce motif
  // dupliqué 6 fois). `getCreateValues` reproduit le seul comportement que
  // le hook ne couvrait pas nativement : pré-remplir `order` avec le nombre
  // d'années déjà existantes au moment d'ouvrir le formulaire de création
  // (`startCreate` classique repart toujours d'`emptyValues`). `setCurrent`/
  // `handleSetCurrent` restent hors du hook — action propre à cet onglet,
  // sans équivalent dans les 5 autres.
  const {
    showForm,
    setShowForm,
    editingId,
    values,
    pendingDelete,
    setPendingDelete,
    startCreate,
    startEdit,
    handleSubmit,
    confirmDelete,
  } = useCrudTab<
    SchoolYear,
    SchoolYearValues,
    { id?: string; label: string; order?: number }
  >({
    emptyValues: emptySchoolYear,
    getCreateValues: () => ({ label: "", order: String(schoolYears.length) }),
    toFormValues: (y) => ({ label: y.label, order: String(y.order) }),
    toPayload: (v, editingId) => ({
      id: editingId ?? undefined,
      label: v.label,
      order: v.order ? Number(v.order) : undefined,
    }),
    upsert,
    del,
    labels: {
      createSuccess: "Année scolaire ajoutée.",
      updateSuccess: "Année scolaire mise à jour.",
      deleteSuccess: "Année scolaire supprimée.",
    },
  });

  async function handleSetCurrent(schoolYearId: string) {
    try {
      await setCurrent.mutateAsync(schoolYearId);
      toast.success("Année scolaire courante mise à jour.");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          "Impossible de définir cette année comme courante.",
      );
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Utilisées dans les sélecteurs "Année scolaire" de l'application
            (Inscriptions, Écolage, Décisions de fin d'année…) — l'année
            "courante" préremplit ces sélecteurs par défaut.
          </p>
          <Button size="sm" onClick={startCreate}>
            + Nouvelle année scolaire
          </Button>
        </div>
        <ul className="divide-y">
          {schoolYears.map((y) => (
            <li
              key={y.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                {y.label}
                {y.id === currentSchoolYearId && <Badge>Courante</Badge>}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">ordre {y.order}</span>
                {y.id !== currentSchoolYearId && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => handleSetCurrent(y.id)}
                    disabled={setCurrent.isPending}
                  >
                    Définir comme courante
                  </Button>
                )}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => startEdit(y)}
                >
                  Modifier
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setPendingDelete(y.id)}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
          {schoolYears.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              Aucune année scolaire pour l'instant.
            </li>
          )}
        </ul>
      </CardContent>
      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={
          editingId ? "Modifier l'année scolaire" : "Nouvelle année scolaire"
        }
        description={
          editingId
            ? `Modification de « ${nameOf(
                schoolYears.map((y) => ({ id: y.id, name: y.label })),
                editingId,
              )} ».`
            : undefined
        }
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={values}
          validationSchema={SchoolYearSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <TextInputField
                name="label"
                label="Libellé"
                placeholder="ex: 2025-2026"
              />
              <TextInputField
                name="order"
                type="number"
                label="Ordre (pour déduire « l'année suivante »)"
              />
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
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer cette année scolaire ?"
        description="Impossible si des inscriptions, de l'écolage ou des décisions de fin d'année la référencent encore — le message d'erreur le précisera le cas échéant."
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------

export default function StructurePage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const parametersQuery = useSchoolParametersQuery(school.id);
  const params = parametersQuery.data;

  // Itération 52 (Étape 3) — corrige le bug "Must" documenté par l'audit :
  // avant ce correctif, une erreur réseau/serveur laissait `isLoading` passer
  // à `false` sans que `params` soit jamais défini, donc la page restait
  // bloquée indéfiniment sur "Chargement…" sans aucun moyen de réessayer.
  if (parametersQuery.isError) {
    return (
      <PageTransition className="space-y-6">
        <PageHeader
          title="Structure pédagogique"
          description="Cycle → Classe → Série → Groupe, et les salles de classe — la base de tout le reste de l'application."
        />
        <ErrorState onRetry={() => parametersQuery.refetch()} />
      </PageTransition>
    );
  }

  if (parametersQuery.isLoading || !params)
    return <p className="text-muted-foreground">Chargement…</p>;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Structure pédagogique"
        description="Cycle → Classe → Série → Groupe, et les salles de classe — la base de tout le reste de l'application."
      />

      <Tabs defaultValue="cycles">
        <TabsList>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="series">Séries</TabsTrigger>
          <TabsTrigger value="groupes">Groupes</TabsTrigger>
          <TabsTrigger value="salles">Salles</TabsTrigger>
          <TabsTrigger value="school-years">Années scolaires</TabsTrigger>
        </TabsList>
        <TabsContent value="cycles">
          <CyclesTab schoolId={school.id} cycles={params.cycles} />
        </TabsContent>
        <TabsContent value="classes">
          <ClassesTab
            schoolId={school.id}
            cycles={params.cycles}
            classes={params.classes}
          />
        </TabsContent>
        <TabsContent value="series">
          <SeriesTab
            schoolId={school.id}
            classes={params.classes}
            series={params.series}
          />
        </TabsContent>
        <TabsContent value="groupes">
          <GroupesTab
            schoolId={school.id}
            classes={params.classes}
            series={params.series}
            groupes={params.groupes}
          />
        </TabsContent>
        <TabsContent value="salles">
          <SallesTab schoolId={school.id} salles={params.salles} />
        </TabsContent>
        <TabsContent value="school-years">
          <SchoolYearsTab
            schoolId={school.id}
            schoolYears={params.schoolYears}
            currentSchoolYearId={params.currentSchoolYearId}
          />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
