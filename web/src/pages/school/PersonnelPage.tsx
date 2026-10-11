import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { StaffMember } from "../../types";
import {
  staffPhotoUrl,
  useCreateStaffMutation,
  useDeleteStaffMutation,
  useDeleteStaffPhotoMutation,
  useStaffQuery,
  useStaffStatsQuery,
  useUpdateStaffMutation,
  useUploadStaffPhotoMutation,
} from "../../features/personnel/api";
import StatCard from "../../components/StatCard";
import { SkeletonStatCard } from "../../components/Skeleton";
import PageHeader from "../../components/PageHeader";
import { StaffStatusBadge } from "../../components/StatusBadge";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import FormDialog from "../../components/FormDialog";
import PhotoManagerDialog from "../../components/PhotoManagerDialog";
import ErrorState from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextInputField, SelectField } from "@/components/form";
import PageTransition from "@/components/motion/PageTransition";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { useSearchParamsState } from "@/providers/hooks/useSearchParamsState";
import { useDebouncedValue } from "@/providers/hooks/useDebouncedValue";

interface StaffFormValues {
  fullName: string;
  specialite: string;
  fonction: string;
  diplome: string;
  typeContrat: string;
  salaireBrut: string;
  heuresSemaine: string;
  statut: string;
}

const emptyValues: StaffFormValues = {
  fullName: "",
  specialite: "",
  fonction: "",
  diplome: "",
  typeContrat: "",
  salaireBrut: "",
  heuresSemaine: "",
  statut: "Actif",
};

const ALL_VALUE = "__all__";

const STATUT_OPTIONS = [
  { value: "Actif", label: "Actif" },
  { value: "Inactif", label: "Inactif" },
  { value: "Congé", label: "Congé" },
];

const StaffSchema = Yup.object({
  fullName: Yup.string()
    .trim()
    .min(2, "2 caractères minimum")
    .required("Le nom & prénom sont requis."),
  specialite: Yup.string().optional(),
  fonction: Yup.string().optional(),
  diplome: Yup.string().optional(),
  typeContrat: Yup.string().optional(),
  salaireBrut: Yup.number()
    .typeError("Nombre requis.")
    .min(0, "Doit être positif.")
    .optional(),
  heuresSemaine: Yup.number()
    .typeError("Nombre requis.")
    .min(0, "Doit être positif.")
    .optional(),
  statut: Yup.string().optional(),
});


export default function Personnel() {
  const { school } = useOutletContext<SchoolOutletContext>();

  const [search, setSearch] = useSearchParamsState("q");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statutFilter, setStatutFilter] = useSearchParamsState("statut");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const staffQuery = useStaffQuery(
    school.id,
    { search: debouncedSearch || undefined, statut: statutFilter || undefined },
    { page, pageSize },
  );
  const statsQuery = useStaffStatsQuery(school.id);
  const createStaff = useCreateStaffMutation(school.id);
  const updateStaff = useUpdateStaffMutation(school.id);
  const deleteStaff = useDeleteStaffMutation(school.id);
  const uploadStaffPhoto = useUploadStaffPhotoMutation(school.id);
  const deleteStaffPhoto = useDeleteStaffPhotoMutation(school.id);

  // Retour à la page 1 dès qu'un filtre change (même principe que StudentsPage.tsx).
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statutFilter]);

  const staff = staffQuery.data?.data ?? [];
  const staffPagination = staffQuery.data?.pagination;
  const stats = statsQuery.data ?? null;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialValues, setInitialValues] =
    useState<StaffFormValues>(emptyValues);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [photoStaffId, setPhotoStaffId] = useState<string | null>(null);
  const photoStaff = staff.find((m) => m.id === photoStaffId) ?? null;

  function startCreate() {
    setEditingId(null);
    setInitialValues(emptyValues);
    setShowForm(true);
  }

  function startEdit(member: StaffMember) {
    setEditingId(member.id);
    setInitialValues({
      fullName: member.fullName,
      specialite: member.specialite || "",
      fonction: member.fonction || "",
      diplome: member.diplome || "",
      typeContrat: member.typeContrat || "",
      salaireBrut: member.salaireBrut != null ? String(member.salaireBrut) : "",
      heuresSemaine:
        member.heuresSemaine != null ? String(member.heuresSemaine) : "",
      statut: member.statut || "Actif",
    });
    setShowForm(true);
  }

  async function handleSubmit(
    values: StaffFormValues,
    helpers: FormikHelpers<StaffFormValues>,
  ) {
    const payload = {
      fullName: values.fullName,
      specialite: values.specialite || undefined,
      fonction: values.fonction || undefined,
      diplome: values.diplome || undefined,
      typeContrat: values.typeContrat || undefined,
      salaireBrut: values.salaireBrut ? Number(values.salaireBrut) : undefined,
      heuresSemaine: values.heuresSemaine
        ? Number(values.heuresSemaine)
        : undefined,
      statut: values.statut || undefined,
    };
    try {
      if (editingId) {
        await updateStaff.mutateAsync({ id: editingId, payload });
        toast.success("Fiche mise à jour.");
      } else {
        await createStaff.mutateAsync(payload);
        toast.success("Membre du personnel créé.");
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
      await deleteStaff.mutateAsync(pendingDeleteId);
      toast.success("Membre du personnel supprimé.");
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const columns: DataTableColumn<StaffMember>[] = [
    {
      header: "",
      cell: (m) =>
        m.hasPhoto ? (
          <img
            src={staffPhotoUrl(school.id, m.id)}
            alt={m.fullName}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
          </div>
        ),
    },
    {
      header: "Nom & prénom",
      cell: (m) => <span className="font-medium">{m.fullName}</span>,
    },
    {
      header: "Fonction",
      cell: (m) => (
        <span className="text-muted-foreground">{m.fonction ?? "—"}</span>
      ),
    },
    {
      header: "Spécialité",
      cell: (m) => (
        <span className="text-muted-foreground">{m.specialite ?? "—"}</span>
      ),
    },
    {
      header: "Contrat",
      cell: (m) => (
        <span className="text-muted-foreground">{m.typeContrat ?? "—"}</span>
      ),
    },
    { header: "Heures/semaine", cell: (m) => m.heuresSemaine ?? "—" },
    {
      header: "Salaire brut",
      cell: (m) =>
        m.salaireBrut != null
          ? `${Number(m.salaireBrut).toLocaleString("fr-FR")} ${school.currency}`
          : "—",
    },
    { header: "Statut", cell: (m) => <StaffStatusBadge status={m.statut} /> },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Personnel"
        description="Enseignants et personnel administratif de l'école."
        actions={<Button onClick={startCreate}>+ Nouveau membre</Button>}
      />

      {statsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      ) : (
        stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Personnel" value={stats.total} />
            <StatCard label="Actifs" value={stats.actifs} />
            <StatCard
              label="Heures/semaine cumulées"
              value={stats.totalHeuresSemaine}
            />
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher un nom…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select
          value={statutFilter || ALL_VALUE}
          onValueChange={(v) => setStatutFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
            {STATUT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier la fiche" : "Nouveau membre du personnel"}
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={initialValues}
          validationSchema={StaffSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <TextInputField
                  name="fullName"
                  label="Nom & prénom"
                  wrapperClassName="col-span-2"
                />
                <TextInputField
                  name="fonction"
                  label="Fonction"
                  placeholder="ex : Enseignant"
                />
                <TextInputField
                  name="specialite"
                  label="Spécialité"
                  placeholder="ex : Mathématiques"
                />
                <TextInputField name="diplome" label="Diplôme" />
                <TextInputField
                  name="typeContrat"
                  label="Type de contrat"
                  placeholder="ex : CDI"
                />
                <TextInputField
                  name="salaireBrut"
                  label="Salaire brut"
                  type="number"
                  min="0"
                  step="0.01"
                />
                <TextInputField
                  name="heuresSemaine"
                  label="Heures/semaine"
                  type="number"
                  min="0"
                />
                <SelectField
                  name="statut"
                  label="Statut"
                  options={STATUT_OPTIONS}
                  placeholder="Choisir…"
                  wrapperClassName="col-span-2 sm:col-span-1"
                />
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

      {staffQuery.isError ? (
        <ErrorState onRetry={() => staffQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={staff}
          rowKey={(m) => m.id}
          loading={staffQuery.isLoading}
          emptyMessage="Aucun membre du personnel ne correspond à ces filtres."
          serverPagination={
            staffPagination
              ? {
                  page: staffPagination.page,
                  pageSize: staffPagination.pageSize,
                  total: staffPagination.total,
                  onPageChange: setPage,
                }
              : undefined
          }
          rowActions={(m) => (
            <>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => startEdit(m)}
              >
                Modifier
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 pl-3"
                onClick={() => setPhotoStaffId(m.id)}
              >
                Photo
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 pl-3 text-destructive"
                onClick={() => setPendingDeleteId(m.id)}
              >
                Supprimer
              </Button>
            </>
          )}
        />
      )}

      {photoStaff && (
        <PhotoManagerDialog
          open={photoStaffId !== null}
          onOpenChange={(open) => !open && setPhotoStaffId(null)}
          title={`Photo — ${photoStaff.fullName}`}
          entityLabel={photoStaff.fullName}
          photoUrl={
            photoStaff.hasPhoto ? staffPhotoUrl(school.id, photoStaff.id) : null
          }
          onUpload={(file, onProgress) =>
            uploadStaffPhoto.mutateAsync({
              staffId: photoStaff.id,
              file,
              onUploadProgress: onProgress,
            })
          }
          onDelete={() => deleteStaffPhoto.mutateAsync(photoStaff.id)}
        />
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer ce membre du personnel ?"
        description={
          <>
            {staff.find((m) => m.id === pendingDeleteId)?.fullName ??
              "Ce membre"}{" "}
            sera définitivement supprimé. S'il est assigné comme enseignant sur
            un coefficient matière/classe, cette assignation sera simplement
            retirée. Cette action est irréversible.
          </>
        }
        onConfirm={confirmDelete}
        loading={deleteStaff.isPending}
      />
    </PageTransition>
  );
}
