import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FormikHelpers } from "formik";
import { toast } from "sonner";
import { TuitionFee, FeeStatus } from "@/types";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import { useStudentsQuery } from "@/features/students/api";
import {
  useCreateTuitionFeeMutation,
  useDeleteTuitionFeeMutation,
  useGenerateTuitionFeesMutation,
  useRecordTuitionPaymentMutation,
  useTuitionFeesQuery,
  useTuitionFeeStatsQuery,
  useUpdateTuitionFeeMutation,
} from "@/features/tuition/api";
import { MONTH_LABELS, monthLabel } from "@/features/tuition/months";
import {
  GenerateFeesForm,
  GenerateFormValues,
} from "@/features/tuition/components/GenerateFeesForm";
import {
  TuitionFeeForm,
  TuitionFormValues,
} from "@/features/tuition/components/TuitionFeeForm";
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


export default function TuitionPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const defaultYear = school.currentSchoolYearId || "";

  const [search, setSearch] = useSearchParamsState("recherche");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [yearFilter, setYearFilter] = useSearchParamsState(
    "annee",
    defaultYear,
  );
  const [monthFilterParam, setMonthFilterParam] = useSearchParamsState("mois");
  const monthFilter = monthFilterParam ? Number(monthFilterParam) : "";
  const [groupeFilter, setGroupeFilter] = useSearchParamsState("classe");
  const [statusFilterParam, setStatusFilterParam] =
    useSearchParamsState("statut");
  const statusFilter = statusFilterParam as FeeStatus | "";
  const [pageParam, setPageParam] = useSearchParamsState("page", "1");
  const page = Number(pageParam) || 1;
  const pageSize = 20;

  const feesQuery = useTuitionFeesQuery(
    school.id,
    {
      schoolYearId: yearFilter || undefined,
      month: monthFilter || undefined,
      groupeId: groupeFilter || undefined,
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
    },
    { page, pageSize },
  );

  useEffect(() => {
    setPageParam("1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    yearFilter,
    monthFilterParam,
    groupeFilter,
    statusFilterParam,
    debouncedSearch,
  ]);

  const statsQuery = useTuitionFeeStatsQuery(
    school.id,
    yearFilter || undefined,
    monthFilter || undefined,
    groupeFilter || undefined,
  );
  const parametersQuery = useSchoolParametersQuery(school.id);

  const [showForm, setShowForm] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);


  const studentsQuery = useStudentsQuery(
    school.id,
    {},
    { all: true },
    showForm,
  );
  const createFee = useCreateTuitionFeeMutation(school.id);
  const updateFee = useUpdateTuitionFeeMutation(school.id);
  const recordPayment = useRecordTuitionPaymentMutation(school.id);
  const deleteFee = useDeleteTuitionFeeMutation(school.id);
  const generateFees = useGenerateTuitionFeesMutation(school.id);

  const fees = feesQuery.data?.data ?? [];
  const feesPagination = feesQuery.data?.pagination;
  const stats = statsQuery.data ?? null;
  const groupes = parametersQuery.data?.groupes ?? [];
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];
  const schoolYears = parametersQuery.data?.schoolYears ?? [];
  const students = studentsQuery.data?.data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<TuitionFormValues>({
    studentId: "",
    schoolYearId: defaultYear,
    month: "",
    amountDue: "",
    amountPaid: "",
    discountAmount: "",
    discountReason: "",
    paymentMode: "",
    paymentDate: "",
  });

  const [selectedMonths, setSelectedMonths] = useState<number[]>(
    MONTH_LABELS.map(([m]) => m),
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setInitialValues({
      studentId: "",
      schoolYearId: yearFilter || defaultYear,
      month: "",
      amountDue: "",
      amountPaid: "",
      discountAmount: "",
      discountReason: "",
      paymentMode: "",
      paymentDate: "",
    });
    setShowForm(true);
    setShowGenerateForm(false);
  }

  function startEdit(fee: TuitionFee) {
    setEditingId(fee.id);
    setInitialValues({
      studentId: fee.studentId,
      schoolYearId: fee.schoolYearId,
      month: String(fee.month),
      amountDue: fee.amountDue,
      amountPaid: fee.amountPaid,
      discountAmount: fee.discountAmount || "",
      discountReason: fee.discountReason || "",
      paymentMode: fee.paymentMode || "",
      paymentDate: fee.paymentDate ? fee.paymentDate.slice(0, 10) : "",
    });
    setShowForm(true);
    setShowGenerateForm(false);
  }

  async function handleSubmit(
    values: TuitionFormValues,
    helpers: FormikHelpers<TuitionFormValues>,
  ) {
    const payload = {
      studentId: values.studentId,
      schoolYearId: values.schoolYearId,
      month: Number(values.month),
      amountDue: Number(values.amountDue),
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
        await updateFee.mutateAsync({ id: editingId, payload });
        toast.success("Écolage mis à jour.");
      } else {
        await createFee.mutateAsync(payload);
        toast.success("Écolage enregistré.");
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
      await deleteFee.mutateAsync(pendingDeleteId);
      toast.success("Écolage supprimé.");
      if (expandedId === pendingDeleteId) setExpandedId(null);
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  function togglePayment(fee: TuitionFee) {
    setExpandedId(expandedId === fee.id ? null : fee.id);
  }

  async function handleRecordPayment(
    feeId: string,
    values: PaymentFormValues,
    helpers: FormikHelpers<PaymentFormValues>,
  ) {
    try {
      await recordPayment.mutateAsync({
        id: feeId,
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

  function toggleMonth(month: number) {
    setSelectedMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month].sort((a, b) => a - b),
    );
  }

  async function handleGenerate(
    values: GenerateFormValues,
    helpers: FormikHelpers<GenerateFormValues>,
  ) {
    if (selectedMonths.length === 0) {
      toast.error("Sélectionnez au moins un mois.");
      helpers.setSubmitting(false);
      return;
    }
    try {
      const result = await generateFees.mutateAsync({
        schoolYearId: values.schoolYearId,
        groupeId: values.groupeId || undefined,
        months: selectedMonths,
        discountAmount: values.discountAmount
          ? Number(values.discountAmount)
          : undefined,
        discountReason: values.discountAmount
          ? values.discountReason || undefined
          : undefined,
      });
      if (result.created > 0) {
        toast.success(`${result.created} ligne(s) d'écolage générée(s).`);
      } else {
        toast.success(
          "Aucune nouvelle ligne à générer (déjà toutes présentes).",
        );
      }
      if (result.unconfiguredLevels.length > 0) {
        toast.warning(
          `Tarif mensuel non configuré pour : ${result.unconfiguredLevels.join(", ")}. Complétez-le dans Paramètres avant de corriger ces montants.`,
        );
      }
      setShowGenerateForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Génération impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  const columns: DataTableColumn<TuitionFee>[] = [
    {
      header: "Élève",
      cell: (f) => (
        <div>
          <p className="font-medium">{f.student.fullName}</p>
          <p className="text-xs text-muted-foreground">{f.student.matricule}</p>
        </div>
      ),
    },
    {
      header: "Classe",
      cell: (f) =>
        groupeLabelById(
          f.student.groupeId,
          groupes,
          classes,
          series,
          f.student.groupe?.name,
        ),
    },
    { header: "Année", cell: (f) => f.schoolYear.label },
    { header: "Mois", cell: (f) => monthLabel(f.month) },
    {
      header: "Dû",
      cell: (f) =>
        `${Number(f.amountDue).toLocaleString("fr-FR")} ${school.currency}`,
    },
    {
      header: "Payé",
      cell: (f) =>
        `${Number(f.amountPaid).toLocaleString("fr-FR")} ${school.currency}`,
    },
    {
      header: "Reste",
      cell: (f) => {
        const remaining = Number(f.amountDue) - Number(f.amountPaid);
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
      cell: (f) =>
        Number(f.discountAmount) > 0 ? (
          <span title={f.discountReason || undefined}>
            -{Number(f.discountAmount).toLocaleString("fr-FR")}{" "}
            {school.currency}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { header: "Statut", cell: (f) => <FeeStatusBadge status={f.status} /> },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Écolage"
        description={school.name}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerateForm((v) => !v);
                setShowForm(false);
              }}
            >
              Générer en masse
            </Button>
            <Button onClick={startCreate}>+ Ligne manuelle</Button>
          </>
        }
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
            <StatCard label="Lignes" value={stats.count} />
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
          value={monthFilter ? String(monthFilter) : ALL_VALUE}
          onValueChange={(v) => setMonthFilterParam(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tous les mois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les mois</SelectItem>
            {MONTH_LABELS.map(([m, label]) => (
              <SelectItem key={m} value={String(m)}>
                {label}
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
        open={showGenerateForm}
        onOpenChange={setShowGenerateForm}
        title="Générer l'écolage en masse"
      >
        <GenerateFeesForm
          schoolYears={schoolYears}
          groupes={groupes}
          classes={classes}
          series={series}
          defaultSchoolYearId={yearFilter || defaultYear}
          selectedMonths={selectedMonths}
          onToggleMonth={toggleMonth}
          onSubmit={handleGenerate}
          onCancel={() => setShowGenerateForm(false)}
        />
      </FormDialog>

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier l'écolage" : "Nouvelle ligne d'écolage"}
      >
        <TuitionFeeForm
          editingId={editingId}
          initialValues={initialValues}
          students={students}
          schoolYears={schoolYears}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      </FormDialog>

      <DataTable
        columns={columns}
        data={fees}
        rowKey={(f) => f.id}
        loading={feesQuery.isLoading}
        emptyMessage="Aucun écolage ne correspond à ces filtres."
        serverPagination={
          feesPagination
            ? {
                page: feesPagination.page,
                pageSize: feesPagination.pageSize,
                total: feesPagination.total,
                onPageChange: (p) => setPageParam(String(p)),
              }
            : undefined
        }
        isRowExpanded={(f) => expandedId === f.id}
        rowActions={(f) => (
          <>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => togglePayment(f)}
            >
              {expandedId === f.id ? "Fermer" : "Paiement"}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-3"
              onClick={() => startEdit(f)}
            >
              Modifier
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-3 text-destructive"
              onClick={() => setPendingDeleteId(f.id)}
            >
              Supprimer
            </Button>
          </>
        )}
        renderExpandedRow={(f) => (
          <div className="space-y-3 py-2">
            <RecordPaymentForm
              onSubmit={(values, helpers) =>
                handleRecordPayment(f.id, values, helpers)
              }
            />
          </div>
        )}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer cette ligne d'écolage ?"
        description={
          <>
            La ligne
            {(() => {
              const target = fees.find((f) => f.id === pendingDeleteId);
              return target
                ? ` de ${target.student.fullName} (${monthLabel(target.month)} ${target.schoolYear.label})`
                : "";
            })()}{" "}
            sera supprimée. Cette action est irréversible.
          </>
        }
        onConfirm={confirmDelete}
        loading={deleteFee.isPending}
      />
    </PageTransition>
  );
}
