import { Link, useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  GraduationCap,
  Landmark,
  School as SchoolIcon,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { SchoolRole } from "@/types";
import { useDashboardQuery } from "@/features/dashboard/api";
import { canAccessRole } from "@/components/RoleGate";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { SkeletonStatCard } from "@/components/Skeleton";
import FinanceEvolutionChart from "@/features/finances/components/FinanceEvolutionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/motion/PageTransition";

// Tableau de bord de l'école (refonte itération 26 — audit UX/UI). Même
// source de données qu'avant (`dashboard.service.ts::getDashboard`, lecture
// pure, aucune nouvelle route backend) : ce qui change, c'est la
// hiérarchie — 4 KPI vraiment mis en avant, une section "Alertes & actions
// rapides" pour ce qui demande une décision (impayés) plutôt qu'une grille
// de 7 StatCard toutes au même niveau. Aucune donnée inventée : pas de
// "présences du jour" par exemple, car `getSchoolAttendanceOverview` agrège
// TOUT l'historique, pas la seule journée en cours — libellé volontairement
// honnête ("cumulé") plutôt que de laisser croire à une vue "aujourd'hui".
export default function SchoolOverview() {
  const { school, myRoles, isSuperAdmin } =
    useOutletContext<SchoolOutletContext>();
  const dashboardQuery = useDashboardQuery(school.id);
  const dashboard = dashboardQuery.data ?? null;
  const can = (roles: SchoolRole[]) =>
    canAccessRole(roles, myRoles, isSuperAdmin);

  const infoRows: [string, string | null | undefined][] = [
    ["Directeur", school.director],
    ["Adresse", school.address],
    ["Téléphone", school.phone],
    ["Email", school.email],
    ["N° Arrêté", school.arreteNumber],
    ["Année scolaire", school.currentSchoolYear?.label],
    ["Cycle", school.cycle],
    ["Monnaie", school.currency],
  ];

  const quickActions: {
    to: string;
    label: string;
    hint: string;
    icon: typeof Users;
    roles: SchoolRole[];
  }[] = [
    {
      to: "students",
      label: "Élèves",
      hint: "Inscrire un nouvel élève",
      icon: Users,
      roles: ["ADMIN", "GESTION_ELEVES"] as SchoolRole[],
    },
    {
      to: "attendance",
      label: "Présences",
      hint: "Prendre les présences du jour",
      icon: CalendarCheck,
      roles: ["ADMIN", "GESTION_ELEVES"] as SchoolRole[],
    },
    {
      to: "grades",
      label: "Notes",
      hint: "Saisir des notes",
      icon: GraduationCap,
      roles: ["ADMIN", "GESTION_NOTES"] as SchoolRole[],
    },
    {
      to: "enrollments",
      label: "Paiements",
      hint: "Enregistrer un paiement",
      icon: Wallet,
      roles: ["ADMIN", "GESTION_FINANCES"] as SchoolRole[],
    },
  ].filter((a) => can(a.roles));

  const impayes = dashboard?.enrollments.impaye ?? 0;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description={`${school.name}${dashboard?.schoolYearLabel ? ` — année scolaire ${dashboard.schoolYearLabel}` : ""}`}
        actions={
          isSuperAdmin ? (
            <Badge>Superadmin</Badge>
          ) : (
            myRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {myRoles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            )
          )
        }
      />

      {/* Vue générale — les 4 chiffres qu'un directeur regarde en premier. */}
      {dashboardQuery.isLoading || !dashboard ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            emphasis
            icon={Users}
            label="Élèves"
            value={dashboard.students.total}
            hint={`${dashboard.students.boys} garçons · ${dashboard.students.girls} filles`}
          />
          <StatCard
            emphasis
            icon={UserCog}
            label="Personnel"
            value={dashboard.staff.total}
            hint={`${dashboard.staff.actifs} actif${dashboard.staff.actifs > 1 ? "s" : ""}`}
          />
          <StatCard
            emphasis
            icon={SchoolIcon}
            label="Classes"
            value={dashboard.classCount}
          />
          <StatCard
            emphasis
            icon={CalendarCheck}
            label="Taux de présence (cumulé)"
            value={
              dashboard.attendance.tauxPresence !== null
                ? `${dashboard.attendance.tauxPresence.toFixed(0)} %`
                : "—"
            }
            hint={`${dashboard.attendance.absent} absence${dashboard.attendance.absent > 1 ? "s" : ""} enregistrée${dashboard.attendance.absent > 1 ? "s" : ""} au total`}
          />
        </div>
      )}

      {/* Alertes & actions rapides — ce qui mérite une décision maintenant. */}
      {dashboard && (impayes > 0 || quickActions.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {impayes > 0 && can(["ADMIN", "GESTION_FINANCES"]) && (
            <Card className="border-warning/30 bg-warning/5 lg:col-span-1">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning-foreground">
                  <AlertTriangle className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {impayes} inscription{impayes > 1 ? "s" : ""} impayée
                    {impayes > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    À relancer dans Inscriptions & frais.
                  </p>
                  <Link
                    to="enrollments"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Voir les impayés <ArrowRight className="size-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {quickActions.length > 0 && (
            <Card className={impayes > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {quickActions.map((a) => (
                  <Button
                    key={a.to}
                    asChild
                    variant="outline"
                    className="h-auto flex-col items-start gap-1 py-3 text-left"
                  >
                    <Link to={a.to}>
                      <a.icon className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{a.label}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {a.hint}
                      </span>
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Finances & inscriptions — situation chiffrée, sans redondance avec le graphique en dessous. */}
      {dashboard && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Frais scolaires</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">
                  {dashboard.enrollments.totalPaid.toLocaleString("fr-FR")}{" "}
                  {school.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  sur {dashboard.enrollments.totalDue.toLocaleString("fr-FR")}{" "}
                  {school.currency} attendus
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success"
                  style={{
                    width: `${dashboard.enrollments.totalDue > 0 ? Math.min(100, (dashboard.enrollments.totalPaid / dashboard.enrollments.totalDue) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="secondary">
                  {dashboard.enrollments.solde} soldée
                  {dashboard.enrollments.solde > 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary">
                  {dashboard.enrollments.partiel} partielle
                  {dashboard.enrollments.partiel > 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary">
                  {dashboard.enrollments.impaye} impayée
                  {dashboard.enrollments.impaye > 1 ? "s" : ""}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Solde financier {dashboard.finance.year}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Landmark className="size-5 text-muted-foreground" />
                <span
                  className={`text-2xl font-semibold tabular-nums ${dashboard.finance.solde >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {dashboard.finance.solde.toLocaleString("fr-FR")}{" "}
                  {school.currency}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {dashboard.finance.totalRecettes.toLocaleString("fr-FR")}{" "}
                {school.currency} de recettes ·{" "}
                {dashboard.finance.totalCharges.toLocaleString("fr-FR")}{" "}
                {school.currency} de charges
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <FinanceEvolutionChart schoolId={school.id} currency={school.currency} />

      {/* Fiche établissement — consultée moins souvent que les KPI ci-dessus, reléguée en bas de page. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informations de l'école</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {infoRows
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between border-b py-1 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
          </dl>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
