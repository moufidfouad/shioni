import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { PaymentTrackingRow } from "@/types";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import {
  usePaymentTrackingQuery,
  usePaymentTrackingStatsQuery,
} from "@/features/payment-tracking/api";
import { useDebouncedValue } from "@/providers/hooks/useDebouncedValue";
import { useSearchParamsState } from "@/providers/hooks/useSearchParamsState";
import StatCard from "@/components/StatCard";
import { SkeletonStatCard } from "@/components/Skeleton";
import PageHeader from "@/components/PageHeader";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import ErrorState from "@/components/ErrorState";
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

const MONTH_SHORT: Record<number, string> = {
  1: "Jan",
  2: "Fév",
  3: "Mar",
  4: "Avr",
  5: "Mai",
  6: "Juin",
  7: "Juil",
  8: "Août",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Déc",
};

export default function PaymentTrackingPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const defaultYear = school.currentSchoolYearId || "";

  const [search, setSearch] = useSearchParamsState("q");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [yearFilter, setYearFilter] = useSearchParamsState(
    "annee",
    defaultYear,
  );
  const [groupeFilter, setGroupeFilter] = useSearchParamsState("classe");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const parametersQuery = useSchoolParametersQuery(school.id);
  const groupes = parametersQuery.data?.groupes ?? [];
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];
  const schoolYears = parametersQuery.data?.schoolYears ?? [];

  const filters = {
    schoolYearId: yearFilter,
    groupeId: groupeFilter || undefined,
    search: debouncedSearch || undefined,
  };
  const trackingQuery = usePaymentTrackingQuery(school.id, filters, {
    page,
    pageSize,
  });
  const statsQuery = usePaymentTrackingStatsQuery(school.id, {
    schoolYearId: yearFilter,
    groupeId: groupeFilter || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [yearFilter, groupeFilter, debouncedSearch]);

  const rows = trackingQuery.data?.data ?? [];
  const pagination = trackingQuery.data?.pagination;
  const stats = statsQuery.data ?? null;

  const columns: DataTableColumn<PaymentTrackingRow>[] = [
    {
      header: "Élève",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.student.fullName}</p>
          <p className="text-xs text-muted-foreground">{r.student.matricule}</p>
        </div>
      ),
    },
    {
      header: "Classe",
      cell: (r) =>
        groupeLabelById(
          r.student.groupeId,
          groupes,
          classes,
          series,
          r.student.groupe?.name,
        ),
    },
    {
      header: "Droit d'inscription",
      cell: (r) =>
        r.enrollment ? (
          <div className="space-y-0.5">
            <FeeStatusBadge status={r.enrollment.status} />
            {r.enrollment.status !== "SOLDE" && (
              <p className="text-xs text-muted-foreground">
                Reste{" "}
                {(r.enrollment.feeDue - r.enrollment.amountPaid).toLocaleString(
                  "fr-FR",
                )}{" "}
                {school.currency}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Non suivi</span>
        ),
    },
    {
      header: "Écolage",
      cell: (r) => {
        if (r.tuition.monthsTracked === 0)
          return (
            <span className="text-xs text-muted-foreground">Non suivi</span>
          );
        return (
          <div className="space-y-0.5">
            <span
              className={
                r.tuition.upToDate
                  ? "inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                  : "inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
              }
            >
              {r.tuition.upToDate ? "À jour" : "En retard"}
            </span>
            {!r.tuition.upToDate && (
              <p className="text-xs text-muted-foreground">
                Mois impayés :{" "}
                {r.tuition.monthsUnpaid
                  .map((m) => MONTH_SHORT[m] ?? m)
                  .join(", ")}
              </p>
            )}
          </div>
        );
      },
    },
    {
      header: "Reste écolage",
      cell: (r) => {
        const remaining = r.tuition.totalDue - r.tuition.totalPaid;
        return remaining > 0 ? (
          <span className="text-destructive">
            {remaining.toLocaleString("fr-FR")} {school.currency}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Suivi des paiements"
        description={`${school.name} — droit d'inscription et écolage, par élève`}
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
            <StatCard label="Élèves" value={stats.totalStudents} />
            <StatCard
              label="Inscription à jour"
              value={stats.enrollmentUpToDate}
            />
            <StatCard
              label="Inscription en retard"
              value={stats.enrollmentBehind}
            />
            <StatCard
              label="Inscription non suivie"
              value={stats.enrollmentNotTracked}
            />
            <StatCard label="Écolage à jour" value={stats.tuitionUpToDate} />
            <StatCard label="Écolage en retard" value={stats.tuitionBehind} />
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
            <SelectItem value={ALL_VALUE} disabled>
              Choisir une année…
            </SelectItem>
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
      </div>

      {!yearFilter ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Renseignez une année scolaire pour afficher le suivi.
        </p>
      ) : trackingQuery.isError ? (
        <ErrorState onRetry={() => trackingQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.student.id}
          loading={trackingQuery.isLoading}
          emptyMessage="Aucun élève ne correspond à ces filtres."
          serverPagination={
            pagination
              ? {
                  page: pagination.page,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      )}
    </PageTransition>
  );
}
