import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FormikHelpers } from "formik";
import { toast } from "sonner";
import { Enrollment, FeeStatus } from "@/types";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import { useStudentsQuery } from "@/features/students/api";
import {
  useCreateEnrollmentMutation,
  useDeleteEnrollmentMutation,
  useEnrollmentsQuery,
  useEnrollmentStatsQuery,
  useRecordPaymentMutation,
  useUpdateEnrollmentMutation,
} from "@/features/enrollments/api";
import {
  EnrollmentForm,
  EnrollmentFormValues,
} from "@/features/enrollments/components/EnrollmentForm";
import { useDebouncedValue } from "@/providers/hooks/useDebouncedValue";
import { useSearchParamsState } from "@/providers/hooks/useSearchParamsState";
import StatCard from "@/components/StatCard";
import { SkeletonStatCard } from "@/components/Skeleton";
import PageHeader from "@/components/PageHeader";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FormDialog from "@/components/FormDialog";
import {
  RecordPaymentForm,
  PaymentFormValues,
} from "@/components/RecordPaymentForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageTransition from "@/components/motion/PageTransition";
import { FeeStatusBadge } from "@/components/StatusBadge";
import { groupeLabel, groupeLabelById } from "@/lib/groupeLabel";

const ALL_VALUE = "__all__";


export default function Enrollments() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const defaultYear = school.currentSchoolYearId || "";

  const [search, setSearch] = useSearchParamsState("recherche");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [yearFilter, setYearFilter] = useSearchParamsState(
    "annee",
    defaultYear,
  );
  const [groupeFilter, setGroupeFilter] = useSearchParamsState("classe");
  const [statusFilterParam, setStatusFilterParam] =
    useSearchParamsState("statut");
  const statusFilter = statusFilterParam as FeeStatus | "";
  const [pageParam, setPageParam] = useSearchParamsState("page", "1");
  const page = Number(pageParam) || 1;
  const pageSize = 20;

  const enrollmentsQuery = useEnrollmentsQuery(
    school.id,
    {
      schoolYearId: yearFilter || undefined,
      groupeId: groupeFilter || undefined,
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
    },
    { page, pageSize },
  );

  // Retour à la page 1 dès qu'un filtre change (même principe que StudentsPage.tsx).
  useEffect(() => {
    setPageParam("1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter, groupeFilter, statusFilterParam, debouncedSearch]);

  const statsQuery = useEnrollmentStatsQuery(
    school.id,
    yearFilter || undefined,
    groupeFilter || undefined,
  );
  const parametersQuery = useSchoolParametersQuery(school.id);

  const [showForm, setShowForm] = useState(false);
  // `all: true` — ce sélecteur "élève" du formulaire de création a besoin de
  // TOUS les élèves de l'école (pas seulement une page), voir
  // features/students/api.ts::PageParams. `enabled: showForm` (itération 57)
  // — voir le commentaire de tête de fichier.
  const studentsQuery = useStudentsQuery(
    school.id,
    {},
    { all: true },
    showForm,
  );
  const createEnrollment = useCreateEnrollmentMutation(school.id);
  const updateEnrollment = useUpdateEnrollmentMutation(school.id);
  const recordPayment = useRecordPaymentMutation(school.id);
  const deleteEnrollment = useDeleteEnrollmentMutation(school.id);

  const enrollments = enrollmentsQuery.data?.data ?? [];
  const enrollmentsPagination = enrollmentsQuery.data?.pagination;
  const stats = statsQuery.data ?? null;
  const groupes = parametersQuery.data?.groupes ?? [];
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];
  const feeLevels = parametersQuery.data?.feeLevels ?? [];
  const schoolYears = parametersQuery.data?.schoolYears ?? [];
  const students = studentsQuery.data?.data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<EnrollmentFormValues>({
    studentId: "",
    schoolYearId: defaultYear,
    feeDue: "",
    amountPaid: "",
    discountAmount: "",
    discountReason: "",
    paymentMode: "",
    paymentDate: "",
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setInitialValues({
      studentId: "",
      schoolYearId: yearFilter || defaultYear,
      feeDue: "",
      amountPaid: "",
      discountAmount: "",
      discountReason: "",
      paymentMode: "",
      paymentDate: "",
    });
    setShowForm(true);
  }

  function startEdit(enrollment: Enrollment) {
    setEditingId(enrollment.id);
    setInitialValues({
      studentId: enrollment.studentId,
      schoolYearId: enrollment.schoolYearId,
      feeDue: enrollment.feeDue,
      amountPaid: enrollment.amountPaid,
      discountAmount: enrollment.discountAmount || "",
      discountReason: enrollment.discountReason || "",
      paymentMode: enrollment.paymentMode || "",
      paymentDate: enrollment.paymentDate
        ? enrollment.paymentDate.slice(0, 10)
        : "",
    });
    setShowForm(true);
  }

  async function handleSubmit(
    values: EnrollmentFormValues,
    helpers: FormikHelpers<EnrollmentFormValues>,
  ) {
    const payload = {
      studentId: values.studentId,
      schoolYearId: values.schoolYearId,
      feeDue: Number(values.feeDue),
      amountPaid: values.amountPaid ? Number(values.amountPaid) : undefined,
      discountAmount: values.discountAmount
        ? Number(values.discountAmount)
        : undefined,
      discountReason: values.discountAmount
        ? values.discountReason || undefined
        : undefined,
      paymentMode: values.paymentMode || undefined,
      paymentDate: values.paymentDate || undefined,
    };
    try {
      if (editingId) {
        await updateEnrollment.mutateAsync({ id: editingId, payload });
        toast.success("Inscription mise à jour.");
      } else {
        await createEnrollment.mutateAsync(payload);
        toast.success("Inscription créée.");
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
      await deleteEnrollment.mutateAsync(pendingDeleteId);
      toast.success("Inscription supprimée.");
      if (expandedId === pendingDeleteId) setExpandedId(null);
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  function togglePayment(enrollment: Enrollment) {
    setExpandedId(expandedId === enrollment.id ? null : enrollment.id);
  }

  async function handleRecordPayment(
    enrollmentId: string,
    values: PaymentFormValues,
    helpers: FormikHelpers<PaymentFormValues>,
  ) {
    try {
      await recordPayment.mutateAsync({
        id: enrollmentId,
        amount: Number(values.amount),
        paymentMode: values.paymentMode || undefined,
        paymentDate: values.paymentDate || undefined,
      });
      toast.success("Paiement enregistré.");
      helpers.resetForm();
      setExpandedId(null);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Enregistrement du paiement impossible.",
      );
    } finally {
      helpers.setSubmitting(false);
    }
  }

  const columns: DataTableColumn<Enrollment>[] = [
    {
      header: "Élève",
      cell: (e) => (
        <div>
          <p className="font-medium">{e.student.fullName}</p>
          <p className="text-xs text-muted-foreground">{e.student.matricule}</p>
        </div>
      ),
    },
    {
      header: "Classe",
      cell: (e) =>
        groupeLabelById(
          e.student.groupeId,
          groupes,
          classes,
          series,
          e.student.groupe?.name,
        ),
    },
    { header: "Année", cell: (e) => e.schoolYear.label },
    {
      header: "Frais dû",
      cell: (e) =>
        `${Number(e.feeDue).toLocaleString("fr-FR")} ${school.currency}`,
    },
    {
      header: "Payé",
      cell: (e) =>
        `${Number(e.amountPaid).toLocaleString("fr-FR")} ${school.currency}`,
    },
    {
      header: "Reste",
      cell: (e) => {
        const remaining = Number(e.feeDue) - Number(e.amountPaid);
        return (
          <span
            className={
              remaining > 0 ? "text-destructive" : "text-muted-foreground"
            }
          >
            {remaining.toLocaleString("fr-FR")} {school.currency}
          </span>
        );
      },
    },
    {
      header: "Réduction",
      cell: (e) =>
        Number(e.discountAmount) > 0 ? (
          <span title={e.discountReason || undefined}>
            -{Number(e.discountAmount).toLocaleString("fr-FR")}{" "}
            {school.currency}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "Statut",
      cell: (e) => <FeeStatusBadge status={e.status} />,
    },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Inscriptions & frais"
        description={school.name}
        actions={<Button onClick={startCreate}>+ Nouvelle inscription</Button>}
      />

      {statsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      ) : (
        stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
            <StatCard label="Inscriptions" value={stats.count} />
            <StatCard
              label="Total attendu"
              value={`${stats.totalDue.toLocaleString("fr-FR")} ${school.currency}`}
            />
            <StatCard
              label="Total perçu"
              value={`${stats.totalPaid.toLocaleString("fr-FR")} ${school.currency}`}
            />
            <StatCard
              label="Reste à percevoir"
              value={`${stats.totalRemaining.toLocaleString("fr-FR")} ${school.currency}`}
            />
            <StatCard
              label="Réductions accordées"
              value={`${stats.totalDiscounts.toLocaleString("fr-FR")} ${school.currency}`}
            />
            <StatCard
              label="Soldé / Partiel / Impayé"
              value={`${stats.solde} / ${stats.partiel} / ${stats.impaye}`}
            />
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher un élève…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select
          value={yearFilter || ALL_VALUE}
          onValueChange={(v) => setYearFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Année scolaire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Toutes les années</SelectItem>
            {schoolYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={groupeFilter || ALL_VALUE}
          onValueChange={(v) => setGroupeFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="w-44">
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
        <Select
          value={statusFilter || ALL_VALUE}
          onValueChange={(v) => setStatusFilterParam(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
            <SelectItem value="SOLDE">Soldé</SelectItem>
            <SelectItem value="PARTIEL">Partiel</SelectItem>
            <SelectItem value="IMPAYE">Impayé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier l'inscription" : "Nouvelle inscription"}
      >
        <EnrollmentForm
          editingId={editingId}
          initialValues={initialValues}
          students={students}
          groupes={groupes}
          schoolYears={schoolYears}
          feeLevels={feeLevels}
          currency={school.currency}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      </FormDialog>

      <DataTable
        columns={columns}
        data={enrollments}
        rowKey={(e) => e.id}
        loading={enrollmentsQuery.isLoading}
        emptyMessage="Aucune inscription ne correspond à ces filtres."
        serverPagination={
          enrollmentsPagination
            ? {
                page: enrollmentsPagination.page,
                pageSize: enrollmentsPagination.pageSize,
                total: enrollmentsPagination.total,
                onPageChange: (p) => setPageParam(String(p)),
              }
            : undefined
        }
        isRowExpanded={(e) => expandedId === e.id}
        rowActions={(e) => (
          <>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => togglePayment(e)}
            >
              {expandedId === e.id ? "Fermer" : "Paiement"}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-3"
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
        )}
        renderExpandedRow={(e) => (
          <div className="space-y-3 py-2">
            <RecordPaymentForm
              onSubmit={(values, helpers) =>
                handleRecordPayment(e.id, values, helpers)
              }
            />
          </div>
        )}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer cette inscription ?"
        description={
          <>
            L'inscription
            {(() => {
              const target = enrollments.find((e) => e.id === pendingDeleteId);
              return target
                ? ` de ${target.student.fullName} (${target.schoolYear.label})`
                : "";
            })()}{" "}
            sera supprimée, avec l'historique de paiements associé. Cette action
            est irréversible.
          </>
        }
        onConfirm={confirmDelete}
        loading={deleteEnrollment.isPending}
      />
    </PageTransition>
  );
}
