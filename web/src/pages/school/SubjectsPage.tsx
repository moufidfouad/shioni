import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { Subject } from "@/types";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import { useStaffQuery } from "@/features/personnel/api";
import { groupeLabel, groupeLabelById } from "@/lib/groupeLabel";
import {
  useCreateSubjectMutation,
  useDeleteCoefficientMutation,
  useDeleteSubjectMutation,
  useSetCoefficientsMutation,
  useSubjectsQuery,
  useUpdateSubjectMutation,
} from "@/features/subjects/api";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FormDialog from "@/components/FormDialog";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextInputField, CheckboxField } from "@/components/form";
import PageTransition from "@/components/motion/PageTransition";
import {
  AddCoefficientForm,
  CoefficientFormValues,
  EditCoefficientForm,
  EditCoefficientFormValues,
} from "@/features/subjects/components/CoefficientForm";

interface SubjectFormValues {
  name: string;
  obligatoire: boolean;
}

const emptyValues: SubjectFormValues = { name: "", obligatoire: true };

const SubjectSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, "2 caractères minimum")
    .required("Le nom de la matière est requis."),
  obligatoire: Yup.boolean().required(),
});

type TypeFilter = "" | "obligatoire" | "optionnelle";
const ALL_VALUE = "__all__";


export default function Subjects() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const subjectsQuery = useSubjectsQuery(school.id);
  const parametersQuery = useSchoolParametersQuery(school.id);

  const staffQuery = useStaffQuery(school.id, {}, { all: true });
  const createSubject = useCreateSubjectMutation(school.id);
  const updateSubject = useUpdateSubjectMutation(school.id);
  const deleteSubject = useDeleteSubjectMutation(school.id);
  const setCoefficients = useSetCoefficientsMutation(school.id);
  const deleteCoefficient = useDeleteCoefficientMutation(school.id);

  const subjects = subjectsQuery.data ?? [];
  const groupes = parametersQuery.data?.groupes ?? [];
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];
  const staff = staffQuery.data?.data ?? [];

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchesSearch =
        !search.trim() ||
        s.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesType =
        !typeFilter ||
        (typeFilter === "obligatoire" ? s.obligatoire : !s.obligatoire);
      return matchesSearch && matchesType;
    });
  }, [subjects, search, typeFilter]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialValues, setInitialValues] =
    useState<SubjectFormValues>(emptyValues);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteCoeff, setPendingDeleteCoeff] = useState<{
    subjectId: string;
    groupeId: string;
    groupeName: string;
  } | null>(null);

  
  const [editingCoeffGroupeId, setEditingCoeffGroupeId] = useState<
    string | null
  >(null);

  function startCreate() {
    setEditingId(null);
    setInitialValues(emptyValues);
    setShowForm(true);
  }

  function startEdit(subject: Subject) {
    setEditingId(subject.id);
    setInitialValues({ name: subject.name, obligatoire: subject.obligatoire });
    setShowForm(true);
  }

  async function handleSubmit(
    values: SubjectFormValues,
    helpers: FormikHelpers<SubjectFormValues>,
  ) {
    try {
      if (editingId) {
        await updateSubject.mutateAsync({ id: editingId, payload: values });
        toast.success("Matière mise à jour.");
      } else {
        await createSubject.mutateAsync(values);
        toast.success("Matière créée.");
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmDeleteSubject() {
    if (!pendingDeleteId) return;
    try {
      await deleteSubject.mutateAsync(pendingDeleteId);
      toast.success("Matière supprimée.");
      if (expandedId === pendingDeleteId) setExpandedId(null);
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  function toggleCoefficients(subject: Subject) {
    setExpandedId(expandedId === subject.id ? null : subject.id);
    setEditingCoeffGroupeId(null);
  }

  async function handleAddCoefficient(
    subjectId: string,
    values: CoefficientFormValues,
    helpers: FormikHelpers<CoefficientFormValues>,
  ) {
    try {
      await setCoefficients.mutateAsync({
        subjectId,
        coefficients: [
          {
            groupeId: values.groupeId,
            coefficient: Number(values.coefficient),
            hoursPerWeek: values.hoursPerWeek
              ? Number(values.hoursPerWeek)
              : undefined,
            teacherId: values.teacherId || undefined,
          },
        ],
      });
      toast.success("Coefficient ajouté.");
      helpers.resetForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function handleEditCoefficient(
    subjectId: string,
    groupeId: string,
    values: EditCoefficientFormValues,
    helpers: FormikHelpers<EditCoefficientFormValues>,
  ) {
    try {
      await setCoefficients.mutateAsync({
        subjectId,
        coefficients: [
          {
            groupeId,
            coefficient: Number(values.coefficient),
            hoursPerWeek: values.hoursPerWeek
              ? Number(values.hoursPerWeek)
              : undefined,
            teacherId: values.teacherId || undefined,
          },
        ],
      });
      toast.success("Coefficient mis à jour.");
      setEditingCoeffGroupeId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmDeleteCoefficient() {
    if (!pendingDeleteCoeff) return;
    try {
      await deleteCoefficient.mutateAsync({
        subjectId: pendingDeleteCoeff.subjectId,
        groupeId: pendingDeleteCoeff.groupeId,
      });
      toast.success("Coefficient retiré.");
      setPendingDeleteCoeff(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const columns: DataTableColumn<Subject>[] = [
    {
      header: "Matière",
      cell: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      header: "Type",
      cell: (s) => (
        <Badge variant={s.obligatoire ? "default" : "secondary"}>
          {s.obligatoire ? "Obligatoire" : "Optionnelle"}
        </Badge>
      ),
    },
    {
      header: "Classes configurées",
      cell: (s) => (
        <span className="text-muted-foreground">
          {s.coefficients.length} / {groupes.length}
        </span>
      ),
    },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Matières & coefficients"
        description="Une matière, un coefficient (et des heures/semaine) par classe."
        actions={<Button onClick={startCreate}>+ Nouvelle matière</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher une matière…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select
          value={typeFilter || ALL_VALUE}
          onValueChange={(v) =>
            setTypeFilter(v === ALL_VALUE ? "" : (v as TypeFilter))
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les types</SelectItem>
            <SelectItem value="obligatoire">Obligatoire</SelectItem>
            <SelectItem value="optionnelle">Optionnelle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier la matière" : "Nouvelle matière"}
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={initialValues}
          validationSchema={SubjectSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <div className="flex flex-wrap items-end gap-4">
                <TextInputField
                  name="name"
                  label="Nom de la matière"
                  wrapperClassName="min-w-[220px] flex-1"
                />
                <div className="pb-2">
                  <CheckboxField name="obligatoire" label="Obligatoire" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Enregistrement…"
                    : editingId
                      ? "Enregistrer"
                      : "Créer"}
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

      <DataTable
        columns={columns}
        data={filteredSubjects}
        rowKey={(s) => s.id}
        loading={subjectsQuery.isLoading}
        emptyMessage="Aucune matière ne correspond à ces filtres."
        isRowExpanded={(s) => expandedId === s.id}
        rowActions={(s) => (
          <>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => toggleCoefficients(s)}
            >
              {expandedId === s.id ? "Fermer" : "Coefficients"}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-3"
              onClick={() => startEdit(s)}
            >
              Modifier
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-3 text-destructive"
              onClick={() => setPendingDeleteId(s.id)}
            >
              Supprimer
            </Button>
          </>
        )}
        renderExpandedRow={(s) => {
          const configuredIds = new Set(s.coefficients.map((c) => c.groupeId));
          const remainingGroupes = groupes.filter(
            (c) => !configuredIds.has(c.id),
          );

          return (
            <div className="space-y-4 py-2">
              {s.coefficients.length > 0 && (
                <ul className="divide-y">
                  {s.coefficients.map((c) =>
                    editingCoeffGroupeId === c.groupeId ? (
                      <li key={c.id} className="py-2">
                        <EditCoefficientForm
                          groupeLabel={groupeLabelById(
                            c.groupeId,
                            groupes,
                            classes,
                            series,
                            c.groupe.name,
                          )}
                          initialValues={{
                            coefficient: String(c.coefficient),
                            hoursPerWeek:
                              c.hoursPerWeek != null
                                ? String(c.hoursPerWeek)
                                : "",
                            teacherId: c.teacherId ?? "",
                          }}
                          teacherOptions={staff.map((m) => ({
                            value: m.id,
                            label: m.fullName,
                          }))}
                          onSubmit={(values, helpers) =>
                            handleEditCoefficient(
                              s.id,
                              c.groupeId,
                              values,
                              helpers,
                            )
                          }
                          onCancel={() => setEditingCoeffGroupeId(null)}
                        />
                      </li>
                    ) : (
                      <li
                        key={c.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span>
                          {groupeLabelById(
                            c.groupeId,
                            groupes,
                            classes,
                            series,
                            c.groupe.name,
                          )}
                        </span>
                        <div className="flex items-center gap-4">
                          <span>Coefficient {Number(c.coefficient)}</span>
                          {c.hoursPerWeek != null && (
                            <span className="text-muted-foreground">
                              {c.hoursPerWeek} h/semaine
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {c.teacher
                              ? c.teacher.fullName
                              : "Aucun enseignant assigné"}
                          </span>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => setEditingCoeffGroupeId(c.groupeId)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-destructive"
                            onClick={() =>
                              setPendingDeleteCoeff({
                                subjectId: s.id,
                                groupeId: c.groupeId,
                                groupeName: groupeLabelById(
                                  c.groupeId,
                                  groupes,
                                  classes,
                                  series,
                                  c.groupe.name,
                                ),
                              })
                            }
                          >
                            Retirer
                          </Button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}

              {remainingGroupes.length > 0 ? (
                <AddCoefficientForm
                  groupeOptions={remainingGroupes.map((c) => ({
                    value: c.id,
                    label: groupeLabel(c, classes, series),
                  }))}
                  teacherOptions={staff.map((m) => ({
                    value: m.id,
                    label: m.fullName,
                  }))}
                  onSubmit={(values, helpers) =>
                    handleAddCoefficient(s.id, values, helpers)
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Toutes les classes ont déjà un coefficient pour cette matière.
                </p>
              )}
            </div>
          );
        }}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer cette matière ?"
        description={
          <>
            {subjects.find((s) => s.id === pendingDeleteId)?.name ??
              "Cette matière"}{" "}
            sera supprimée, ainsi que tous ses coefficients par classe. Cette
            action est irréversible.
          </>
        }
        onConfirm={confirmDeleteSubject}
        loading={deleteSubject.isPending}
      />

      <ConfirmDialog
        open={pendingDeleteCoeff !== null}
        onOpenChange={(open) => !open && setPendingDeleteCoeff(null)}
        title="Retirer ce coefficient ?"
        description={
          pendingDeleteCoeff
            ? `Le coefficient pour la classe « ${pendingDeleteCoeff.groupeName} » sera retiré de cette matière.`
            : undefined
        }
        confirmLabel="Retirer"
        onConfirm={confirmDeleteCoefficient}
        loading={deleteCoefficient.isPending}
      />
    </PageTransition>
  );
}
