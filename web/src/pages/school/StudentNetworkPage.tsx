import { FormEvent, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  GraduationCap,
  MapPin,
  Search,
  School as SchoolIcon,
} from "lucide-react";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import {
  useStudentNetworkSearchQuery,
  StudentNetworkSearchField,
} from "@/features/student-network/api";
import { EndOfYearDecisionType, FeeStatus, StudentNetworkEntry } from "@/types";
import { useSearchParamsState } from "@/providers/hooks/useSearchParamsState";
import PageHeader from "@/components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EndOfYearDecisionBadge,
  FeeStatusBadge,
  MentionBadge,
  PresenceRateBadge,
} from "@/components/StatusBadge";
import { Skeleton } from "@/components/Skeleton";


const FIELD_LABELS: Record<StudentNetworkSearchField, string> = {
  nationalIdNumber: "Numéro de carte d'identité nationale",
  ministryStudentNumber: "Numéro d'élève (ministère)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function EntryCard({
  entry,
  currency,
}: {
  entry: StudentNetworkEntry;
  currency: string;
}) {
  const financeRows = [
    ...entry.enrollments.map((r) => ({
      ...r,
      kind: "Droit d'inscription" as const,
    })),
    ...entry.tuitionFees.map((r) => ({ ...r, kind: "Écolage" as const })),
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <SchoolIcon className="size-4 text-muted-foreground" />
            {entry.schoolName}
            {entry.schoolIsland && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <MapPin className="size-3" />
                {entry.schoolIsland}
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {entry.fullName} · Matricule {entry.matricule}
            {entry.classeLabel && <> · {entry.classeLabel}</>}
          </p>
          <p className="text-xs text-muted-foreground">
            {entry.sex === "M"
              ? "Masculin"
              : entry.sex === "F"
                ? "Féminin"
                : "Sexe non renseigné"}
            {" · "}
            Né(e) le {formatDate(entry.birthDate)}
            {entry.birthPlace ? ` à ${entry.birthPlace}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PresenceRateBadge rate={entry.attendance.tauxPresence ?? 0} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Bulletins</h4>
          {entry.bulletins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun bulletin (élève sans classe active).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trimestre</TableHead>
                  <TableHead>Moyenne</TableHead>
                  <TableHead>Rang</TableHead>
                  <TableHead>Mention</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.bulletins.map((b) => (
                  <TableRow key={b.trimestre}>
                    <TableCell>Trimestre {b.trimestre}</TableCell>
                    <TableCell>
                      {b.average != null ? b.average.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>
                      {b.rank != null ? `${b.rank} / ${b.classSize}` : "—"}
                    </TableCell>
                    <TableCell>
                      {b.mention ? <MentionBadge mention={b.mention} /> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Présences</h4>
          <p className="text-sm text-muted-foreground">
            {entry.attendance.total === 0
              ? "Aucun relevé de présence."
              : `${entry.attendance.present} présence(s), ${entry.attendance.retard} retard(s), ${entry.attendance.absent} absence(s) — sur ${entry.attendance.total} relevé(s).`}
          </p>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            Décisions de fin d'année
          </h4>
          {entry.endOfYearDecisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune décision enregistrée.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {entry.endOfYearDecisions.map((d, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {d.schoolYearLabel}
                  </span>
                  <EndOfYearDecisionBadge
                    decision={d.decision as EndOfYearDecisionType}
                  />
                  {d.originGroupeLabel && (
                    <span className="text-muted-foreground">
                      {d.originGroupeLabel}
                    </span>
                  )}
                  {d.targetGroupeLabel && (
                    <span className="text-muted-foreground">
                      → {d.targetGroupeLabel}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            Historique financier
          </h4>
          {financeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun frais enregistré.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Année</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Dû</TableHead>
                  <TableHead>Payé</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financeRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.kind}</TableCell>
                    <TableCell>{r.schoolYearLabel}</TableCell>
                    <TableCell>
                      {r.month ? `Mois ${r.month}` : "Année entière"}
                    </TableCell>
                    <TableCell>
                      {r.amountDue.toLocaleString("fr-FR")} {currency}
                    </TableCell>
                    <TableCell>
                      {r.amountPaid.toLocaleString("fr-FR")} {currency}
                    </TableCell>
                    <TableCell>
                      <FeeStatusBadge status={r.status as FeeStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export default function StudentNetworkPage() {
  const { school } = useOutletContext<SchoolOutletContext>();


  const [fieldParam, setFieldParam] = useSearchParamsState(
    "champ",
    "nationalIdNumber",
  );
  const field: StudentNetworkSearchField =
    fieldParam === "ministryStudentNumber"
      ? "ministryStudentNumber"
      : "nationalIdNumber";
  const [valueParam, setValueParam] = useSearchParamsState("valeur", "");
  const [value, setValue] = useState(valueParam);

  // Reflète un changement d'URL externe (navigation précédente/suivante,
  // lien partagé rouvert) dans le champ de saisie.
  useEffect(() => {
    setValue(valueParam);
  }, [valueParam]);

  const submitted = valueParam ? { field, value: valueParam } : null;
  const searchQuery = useStudentNetworkSearchQuery(school.id, submitted);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setValueParam(value.trim());
  }

  const result = searchQuery.data;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Recherche inter-établissements"
        description="Retrouvez le parcours complet d'un élève à travers les établissements, à partir de son numéro de carte d'identité nationale ou de son numéro d'élève (ministère)."
      />

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Rechercher par
          </label>
          <Select value={field} onValueChange={(v) => setFieldParam(v)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FIELD_LABELS) as StudentNetworkSearchField[]).map(
                (f) => (
                  <SelectItem key={f} value={f}>
                    {FIELD_LABELS[f]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Valeur</label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Saisir le numéro…"
            className="w-64"
          />
        </div>
        <Button type="submit" disabled={!value.trim()}>
          <Search className="mr-2 size-4" />
          Rechercher
        </Button>
      </form>

      {!submitted ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Saisissez un numéro puis lancez la recherche pour afficher le parcours
          de l'élève.
        </p>
      ) : searchQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : searchQuery.isError ? (
        <ErrorState
          title="Impossible d'effectuer la recherche"
          description="Une erreur réseau ou serveur est survenue. Vérifiez le numéro saisi puis réessayez."
          onRetry={() => searchQuery.refetch()}
        />
      ) : !result || result.matches.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun élève ne correspond à ce numéro dans aucun établissement.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="size-4" />
            {result.matches.length} fiche{result.matches.length > 1 ? "s" : ""}{" "}
            élève trouvée
            {result.matches.length > 1 ? "s" : ""}, dans{" "}
            {new Set(result.matches.map((m) => m.schoolId)).size} établissement
            {new Set(result.matches.map((m) => m.schoolId)).size > 1 ? "s" : ""}
            .
          </p>
          {result.matches.map((entry) => (
            <EntryCard
              key={entry.studentId}
              entry={entry}
              currency={school.currency}
            />
          ))}
        </div>
      )}
    </PageTransition>
  );
}
