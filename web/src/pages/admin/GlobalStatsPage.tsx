import { Navigate } from "react-router-dom";
import { CalendarCheck, GraduationCap, School as SchoolIcon, Users } from "lucide-react";

import Navbar from "@/components/Navbar";
import PageHeader from "@/components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import ErrorState from "@/components/ErrorState";
import StatCard from "@/components/StatCard";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GlobalStatsEcoleRow } from "@/types";
import { useAuth } from "@/providers/contexts/AuthContext/context";
import { useGlobalStatsQuery } from "@/features/admin-stats/api";



function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)} %`;
}

function num(v: number | null): string {
  return v === null ? "—" : v.toFixed(2);
}

export default function GlobalStatsPage() {
  const { user } = useAuth();

  // Même garde que PublicContentPage.tsx : source de vérité unique
  // (`user.isSuperAdmin`), pas de nouvel équivalent de RoleGate pour une
  // page hors école.
  if (!user?.isSuperAdmin) {
    return <Navigate to="/schools" replace />;
  }

  return <GlobalStatsContent />;
}

function GlobalStatsContent() {
  const query = useGlobalStatsQuery();
  const data = query.data;

  const globalPresence = (() => {
    if (!data) return null;
    const rows = data.presence.byCycle.filter((r) => r.total > 0);
    if (rows.length === 0) return null;
    const present = rows.reduce((sum, r) => sum + (r.tauxPresence! / 100) * r.total, 0);
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    return total > 0 ? (present / total) * 100 : null;
  })();

  const globalMoyenne = (() => {
    if (!data) return null;
    const rows = data.moyennes.byCycle.filter((r) => r.moyenne !== null);
    if (rows.length === 0) return null;
    return rows.reduce((sum, r) => sum + r.moyenne!, 0) / rows.length;
  })();

  const ecoleColumns: DataTableColumn<GlobalStatsEcoleRow>[] = [
    { header: "École", cell: (e) => <span className="font-medium">{e.name}</span> },
    { header: "Île", cell: (e) => <span className="text-muted-foreground">{e.island ?? "—"}</span> },
    { header: "Élèves", cell: (e) => <span className="tabular-nums">{e.effectifs}</span> },
    { header: "Taux de présence", cell: (e) => <span className="tabular-nums">{pct(e.tauxPresence)}</span> },
    { header: "Moyenne générale", cell: (e) => <span className="tabular-nums">{num(e.moyenneGenerale)}</span> },
  ];

  return (
    <div>
      <Navbar />
      <PageTransition>
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <PageHeader
            title="Statistiques globales"
            description="Effectifs, présences et moyennes de toutes les écoles — par année académique, cycle, série et classe."
          />

          {query.isError && <ErrorState onRetry={() => query.refetch()} />}

          {!query.isError && (query.isLoading || !data) && <p className="text-muted-foreground">Chargement…</p>}

          {!query.isError && data && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Écoles" value={data.schoolsCount} icon={SchoolIcon} />
                <StatCard label="Élèves (toutes écoles)" value={data.effectifs.total} icon={Users} emphasis />
                <StatCard label="Taux de présence global" value={pct(globalPresence)} icon={CalendarCheck} />
                <StatCard label="Moyenne générale" value={num(globalMoyenne)} icon={GraduationCap} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Effectifs par année académique</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Année</TableHead><TableHead className="text-right">Élèves</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.effectifs.byYear.map((y) => (
                          <TableRow key={y.label}><TableCell>{y.label}</TableCell><TableCell className="text-right tabular-nums">{y.count}</TableCell></TableRow>
                        ))}
                        {data.effectifs.byYear.length === 0 && (
                          <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Aucune inscription enregistrée.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Basé sur les inscriptions (`Enrollment`) — la seule donnée du schéma qui porte une année
                      académique ; présences et moyennes ci-dessous restent toutes années confondues.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Effectifs par cycle</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead className="text-right">Élèves</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.effectifs.byCycle.map((c) => (
                          <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{c.count}</TableCell></TableRow>
                        ))}
                        {data.effectifs.sansPlacement > 0 && (
                          <TableRow><TableCell className="text-muted-foreground">Sans classe assignée</TableCell><TableCell className="text-right tabular-nums">{data.effectifs.sansPlacement}</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Effectifs par classe</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Classe</TableHead><TableHead className="text-right">Élèves</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.effectifs.byClasse.map((c) => (
                          <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{c.count}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Effectifs par série</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Série</TableHead><TableHead className="text-right">Élèves</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.effectifs.bySerie.map((s) => (
                          <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell className="text-right tabular-nums">{s.count}</TableCell></TableRow>
                        ))}
                        {data.effectifs.bySerie.length === 0 && (
                          <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Aucune série.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Taux de présence par cycle</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead className="text-right">Présence</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.presence.byCycle.map((c) => (
                          <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{pct(c.tauxPresence)}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Moyennes par cycle</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead className="text-right">Moyenne</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.moyennes.byCycle.map((c) => (
                          <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{num(c.moyenne)}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Moyennes par classe</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Classe</TableHead><TableHead className="text-right">Moyenne</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.moyennes.byClasse.map((c) => (
                          <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{num(c.moyenne)}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Moyennes par série</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Série</TableHead><TableHead className="text-right">Moyenne</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.moyennes.bySerie.map((s) => (
                          <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell className="text-right tabular-nums">{num(s.moyenne)}</TableCell></TableRow>
                        ))}
                        {data.moyennes.bySerie.length === 0 && (
                          <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Aucune série.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Par établissement</CardTitle></CardHeader>
                <CardContent>
                  <DataTable
                    columns={ecoleColumns}
                    data={data.byEcole}
                    rowKey={(e) => e.id}
                    emptyMessage="Aucune école."
                    searchable
                    searchPlaceholder="Rechercher une école, une île…"
                    getSearchValue={(e) => `${e.name} ${e.island ?? ""}`}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
