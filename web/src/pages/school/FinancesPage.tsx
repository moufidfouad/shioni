import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { FinanceEntry, FinanceEntryType } from "../../types";
import { SchoolOutletContext } from "../../layouts/SchoolLayout";
import {
  useCreateFinanceEntryMutation,
  useDeleteFinanceEntryMutation,
  useFinanceEntriesQuery,
  useFinanceStatsQuery,
  useUpdateFinanceEntryMutation,
} from "../../features/finances/api";
import { useSearchParamsState } from "../../hooks/useSearchParamsState";
import StatCard from "../../components/StatCard";
import { SkeletonStatCard } from "../../components/Skeleton";
import PageHeader from "../../components/PageHeader";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import FormDialog from "../../components/FormDialog";
import ErrorState from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextInputField, SelectField } from "@/components/form";
import PageTransition from "@/components/motion/PageTransition";

const MONTHS = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

const TYPE_OPTIONS = [
  { value: "RECETTE", label: "Recette" },
  { value: "CHARGE", label: "Charge" },
];

const ALL_VALUE = "__all__";

interface EntryFormValues {
  type: string;
  label: string;
  month: string;
  year: string;
  amount: string;
}

const currentYear = new Date().getFullYear();

const emptyEntryValues: EntryFormValues = {
  type: "RECETTE",
  label: "",
  month: String(new Date().getMonth() + 1),
  year: String(currentYear),
  amount: "",
};

const EntrySchema = Yup.object({
  type: Yup.string().oneOf(["RECETTE", "CHARGE"], "Type invalide.").required("Le type est requis."),
  label: Yup.string().trim().min(2, "2 caractères minimum").required("Le libellé est requis."),
  month: Yup.number().typeError("Nombre requis.").min(1, "1 à 12").max(12, "1 à 12").required("Le mois est requis."),
  year: Yup.number().typeError("Nombre requis.").min(2000, "Année invalide.").max(2100, "Année invalide.").required("L'année est requise."),
  amount: Yup.number().typeError("Nombre requis.").positive("Doit être positif.").required("Le montant est requis."),
});

function monthLabel(month: number) {
  return MONTHS.find((m) => m.value === String(month))?.label ?? String(month);
}

// Reflète la feuille "FINANCES" : écritures manuelles (recettes/charges) par
// mois — distinctes des frais de scolarité par élève (module Inscriptions &
// frais, `Enrollment`), les deux alimentant ensemble le Tableau de bord
// (voir SchoolOverview.tsx). Lecture ouverte à tout membre de l'école,
// écriture réservée à ADMIN/GESTION_FINANCES — même RBAC qu'Inscriptions &
// frais (pas de donnée personnelle sensible ici, contrairement à Personnel).
// Étape 4, Vague 1 (audit §4.4) — l'ancien filtre "année" était un <Input
// type="number"> en texte libre, sans borne, incohérent avec les <Select>
// voisins (mois, type). Fenêtre statique raisonnable autour de l'année
// courante (pas de liste d'années "connues" exposée par l'API des écritures
// financières à interroger à la place).
const YEAR_FILTER_OPTIONS = Array.from({ length: 8 }, (_, i) => String(currentYear - 5 + i));

export default function Finances() {
  const { school } = useOutletContext<SchoolOutletContext>();
  // Étape 4, Vague 1 — filtres synchronisés à l'URL (`?annee=&mois=&type=`),
  // même patron que StudentsPage.tsx (audit §5 point 3). `annee` garde
  // l'année courante comme défaut implicite, comme le `useState` qu'il
  // remplace.
  const [yearFilter, setYearFilter] = useSearchParamsState("annee", String(currentYear));
  const [monthFilter, setMonthFilter] = useSearchParamsState("mois");
  const [typeFilter, setTypeFilter] = useSearchParamsState("type");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const year = yearFilter ? Number(yearFilter) : undefined;
  const month = monthFilter ? Number(monthFilter) : undefined;

  const entriesQuery = useFinanceEntriesQuery(
    school.id,
    {
      year,
      month,
      type: (typeFilter as FinanceEntryType) || undefined,
    },
    { page, pageSize }
  );
  const statsQuery = useFinanceStatsQuery(school.id, year, month);
  const createEntry = useCreateFinanceEntryMutation(school.id);
  const updateEntry = useUpdateFinanceEntryMutation(school.id);
  const deleteEntry = useDeleteFinanceEntryMutation(school.id);

  // Retour à la page 1 dès qu'un filtre change (même principe que StudentsPage.tsx).
  useEffect(() => {
    setPage(1);
  }, [yearFilter, monthFilter, typeFilter]);

  const entries = entriesQuery.data?.data ?? [];
  const entriesPagination = entriesQuery.data?.pagination;
  const stats = statsQuery.data ?? null;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<EntryFormValues>(emptyEntryValues);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setInitialValues(emptyEntryValues);
    setShowForm(true);
  }

  function startEdit(entry: FinanceEntry) {
    setEditingId(entry.id);
    setInitialValues({
      type: entry.type,
      label: entry.label,
      month: String(entry.month),
      year: String(entry.year),
      amount: String(entry.amount),
    });
    setShowForm(true);
  }

  async function handleSubmit(values: EntryFormValues, helpers: FormikHelpers<EntryFormValues>) {
    const payload = {
      type: values.type,
      label: values.label,
      month: Number(values.month),
      year: Number(values.year),
      amount: Number(values.amount),
    };
    try {
      if (editingId) {
        await updateEntry.mutateAsync({ id: editingId, payload });
        toast.success("Écriture mise à jour.");
      } else {
        await createEntry.mutateAsync(payload);
        toast.success("Écriture ajoutée.");
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
      toast.success("Écriture supprimée.");
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const pendingEntry = entries.find((e) => e.id === pendingDeleteId);

  const columns: DataTableColumn<FinanceEntry>[] = [
    {
      header: "Type",
      cell: (e) => (
        <Badge variant={e.type === "RECETTE" ? "default" : "destructive"}>
          {e.type === "RECETTE" ? "Recette" : "Charge"}
        </Badge>
      ),
    },
    { header: "Libellé", cell: (e) => <span className="font-medium">{e.label}</span> },
    { header: "Période", cell: (e) => `${monthLabel(e.month)} ${e.year}` },
    { header: "Montant", cell: (e) => `${Number(e.amount).toLocaleString("fr-FR")} ${school.currency}` },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Finances"
        description="Recettes et charges de l'école, hors frais de scolarité."
        actions={<Button onClick={startCreate}>+ Nouvelle écriture</Button>}
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
            <StatCard label="Recettes" value={`${stats.totalRecettes.toLocaleString("fr-FR")} ${school.currency}`} />
            <StatCard label="Charges" value={`${stats.totalCharges.toLocaleString("fr-FR")} ${school.currency}`} />
            <StatCard
              label="Solde"
              value={`${stats.solde.toLocaleString("fr-FR")} ${school.currency}`}
              hint={stats.solde >= 0 ? "Excédentaire" : "Déficitaire"}
            />
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Select value={yearFilter || ALL_VALUE} onValueChange={(v) => setYearFilter(v === ALL_VALUE ? "" : v)}>
          <SelectTrigger className="w-32" aria-label="Filtrer par année">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Toutes les années</SelectItem>
            {YEAR_FILTER_OPTIONS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter || ALL_VALUE} onValueChange={(v) => setMonthFilter(v === ALL_VALUE ? "" : v)}>
          <SelectTrigger className="w-40" aria-label="Filtrer par mois">
            <SelectValue placeholder="Mois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les mois</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter || ALL_VALUE} onValueChange={(v) => setTypeFilter(v === ALL_VALUE ? "" : v)}>
          <SelectTrigger className="w-40" aria-label="Filtrer par type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier l'écriture" : "Nouvelle écriture"}
      >
        <Formik
          key={editingId ?? "create"}
          initialValues={initialValues}
          validationSchema={EntrySchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <SelectField name="type" label="Type" options={TYPE_OPTIONS} placeholder="Choisir…" />
                <TextInputField
                  name="label"
                  label="Libellé"
                  placeholder="ex : Recettes frais scolaires"
                  wrapperClassName="col-span-2"
                />
                <SelectField name="month" label="Mois" options={MONTHS} placeholder="Choisir…" />
                <TextInputField name="year" label="Année" type="number" />
                <TextInputField name="amount" label="Montant" type="number" min="0" step="0.01" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </FormDialog>

      {entriesQuery.isError ? (
        <ErrorState onRetry={() => entriesQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          rowKey={(e) => e.id}
          loading={entriesQuery.isLoading}
          emptyMessage="Aucune écriture financière ne correspond à ces filtres."
          serverPagination={
            entriesPagination
              ? {
                  page: entriesPagination.page,
                  pageSize: entriesPagination.pageSize,
                  total: entriesPagination.total,
                  onPageChange: setPage,
                }
              : undefined
          }
          rowActions={(e) => (
            <>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => startEdit(e)}>
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
        />
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer cette écriture financière ?"
        description={
          pendingEntry ? (
            <>
              "{pendingEntry.label}" ({monthLabel(pendingEntry.month)} {pendingEntry.year}) sera définitivement
              supprimée.
            </>
          ) : (
            "Cette action est irréversible."
          )
        }
        onConfirm={confirmDelete}
        loading={deleteEntry.isPending}
      />
    </PageTransition>
  );
}
