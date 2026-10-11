import { useMemo } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Building2, CalendarCheck, GraduationCap, Users } from "lucide-react";
import { SchoolOutletContext } from "../../layouts/SchoolLayout";
import { useAnalyticsQuery } from "../../features/analytics/api";
import StatCard from "../../components/StatCard";
import PageHeader from "../../components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import ErrorState from "@/components/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupeLabel } from "@/lib/groupeLabel";

// Itération 35 — demande utilisateur : "dans l'application, on doit pouvoir
// gérer et analyser toutes ses données; par cycle, groupe, série, salle".
// Tableau de bord dédié, distinct de SchoolOverviewPage.tsx (vue d'ensemble
// générale déjà existante) : GET /schools/:schoolId/analytics renvoie la
// hiérarchie complète + tous les agrégats déjà calculés, ce composant se
// contente de filtrer/afficher — voir analytics.service.ts pour le détail
// de chaque calcul (et ses limites assumées, ex. occupation de salle en
// heures brutes plutôt qu'un pourcentage inventé).

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)} %`;
}

function num(v: number | null): string {
  return v === null ? "—" : v.toFixed(2);
}

export default function AnalyticsPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const query = useAnalyticsQuery(school.id);
  const data = query.data;

  // Étape 4, Vague 1 (audit §5 point 3) — filtres synchronisés à l'URL
  // (`?cycle=&classe=&serie=`). Composé directement avec `useSearchParams`
  // (plutôt que le hook générique `useSearchParamsState`, un par clé) car
  // choisir un cycle/une classe doit réinitialiser ses filtres enfants dans
  // le MÊME geste — trois appels séparés à `setSearchParams` risqueraient de
  // s'écraser l'un l'autre plutôt que de composer ; `updateFilters`
  // applique tous les changements demandés sur un seul objet URLSearchParams.
  const [searchParams, setSearchParams] = useSearchParams();
  const cycleId = searchParams.get("cycle") ?? "__all__";
  const classeId = searchParams.get("classe") ?? "__all__";
  const serieId = searchParams.get("serie") ?? "__all__";

  function updateFilters(next: { cycle?: string; classe?: string; serie?: string }) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(next)) {
          if (value === undefined) continue;
          if (value === "__all__") params.delete(key);
          else params.set(key, value);
        }
        return params;
      },
      { replace: true }
    );
  }

  const classesForCycle = useMemo(
    () => (data ? data.structure.classes.filter((c) => cycleId === "__all__" || c.cycleId === cycleId) : []),
    [data, cycleId]
  );
  const seriesForClasse = useMemo(
    () => (data ? data.structure.series.filter((s) => classeId === "__all__" || s.classeId === classeId) : []),
    [data, classeId]
  );

  // Ensemble des classeId autorisées par le filtre cycle (quand aucune
  // classe précise n'est choisie) — évite de dupliquer la traversée
  // cycle -> classes pour chaque table ci-dessous.
  const allowedClasseIds = useMemo(() => {
    if (!data) return null;
    if (classeId !== "__all__") return new Set([classeId]);
    if (cycleId === "__all__") return null;
    return new Set(data.structure.classes.filter((c) => c.cycleId === cycleId).map((c) => c.id));
  }, [data, cycleId, classeId]);

  function groupeMatches(g: { classeId: string; serieId: string | null }) {
    if (serieId !== "__all__") return g.serieId === serieId;
    if (allowedClasseIds) return allowedClasseIds.has(g.classeId);
    return true;
  }

  // Itération 52 (Étape 3) — corrige le même bug "Must" que StructurePage.tsx
  // (voir ce fichier pour le détail) : sans ce garde, une erreur laissait la
  // page bloquée sur "Chargement…" indéfiniment.
  if (query.isError) {
    return (
      <PageTransition className="space-y-6">
        <PageHeader
          title="Analyse pédagogique"
          description="Effectifs, présences, moyennes et occupation des salles — par cycle, classe, série et groupe."
        />
        <ErrorState onRetry={() => query.refetch()} />
      </PageTransition>
    );
  }

  if (query.isLoading || !data) return <p className="text-muted-foreground">Chargement…</p>;

  const filteredGroupesEffectifs = data.effectifs.byGroupe.filter(groupeMatches);
  const filteredGroupesPresence = data.presence.byGroupe.filter((g) => {
    const meta = data.structure.groupes.find((sg) => sg.id === g.id);
    return meta ? groupeMatches(meta) : true;
  });
  const filteredGroupesMoyennes = data.moyennes.byGroupe.filter((g) => {
    const meta = data.structure.groupes.find((sg) => sg.id === g.id);
    return meta ? groupeMatches(meta) : true;
  });

  const totalEffectifs = filteredGroupesEffectifs.reduce((sum, g) => sum + g.count, 0);
  const globalPresence = (() => {
    const rows = filteredGroupesPresence.filter((r) => r.total > 0);
    if (rows.length === 0) return null;
    const present = rows.reduce((sum, r) => sum + (r.tauxPresence! / 100) * r.total, 0);
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    return total > 0 ? (present / total) * 100 : null;
  })();
  const globalMoyenne = (() => {
    const rows = filteredGroupesMoyennes.filter((r) => r.moyenne !== null);
    if (rows.length === 0) return null;
    return rows.reduce((sum, r) => sum + r.moyenne!, 0) / rows.length;
  })();

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Analyse pédagogique"
        description="Effectifs, présences, moyennes et occupation des salles — par cycle, classe, série et groupe."
      />

      <div className="flex flex-wrap gap-3">
        <Select
          value={cycleId}
          onValueChange={(v) => updateFilters({ cycle: v, classe: "__all__", serie: "__all__" })}
        >
          <SelectTrigger className="w-44" aria-label="Filtrer par cycle"><SelectValue placeholder="Cycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous les cycles</SelectItem>
            {data.structure.cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={classeId}
          onValueChange={(v) => updateFilters({ classe: v, serie: "__all__" })}
        >
          <SelectTrigger className="w-44" aria-label="Filtrer par classe"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes les classes</SelectItem>
            {classesForCycle.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={serieId} onValueChange={(v) => updateFilters({ serie: v })}>
          <SelectTrigger className="w-44" aria-label="Filtrer par série"><SelectValue placeholder="Série" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes les séries</SelectItem>
            {seriesForClasse.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Élèves (groupes filtrés)" value={totalEffectifs} icon={Users} emphasis />
        <StatCard label="Taux de présence" value={pct(globalPresence)} icon={CalendarCheck} />
        <StatCard label={`Moyenne (trimestre ${data.trimestre})`} value={num(globalMoyenne)} icon={GraduationCap} />
        <StatCard label="Salles configurées" value={data.structure.salles.length} icon={Building2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Effectifs par cycle</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Cycle</TableHead><TableHead className="text-right">Élèves</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.effectifs.byCycle.map((c) => (
                  <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{c.count}</TableCell></TableRow>
                ))}
                {data.effectifs.sansGroupe > 0 && (
                  <TableRow><TableCell className="text-muted-foreground">Sans groupe</TableCell><TableCell className="text-right tabular-nums">{data.effectifs.sansGroupe}</TableCell></TableRow>
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
                  <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{pct(c.tauxPresence)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Effectifs par groupe</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Groupe</TableHead><TableHead className="text-right">Élèves</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredGroupesEffectifs.map((g) => (
                  <TableRow key={g.id}><TableCell>{groupeLabel(g, data.structure.classes, data.structure.series)}</TableCell><TableCell className="text-right tabular-nums">{g.count}</TableCell></TableRow>
                ))}
                {filteredGroupesEffectifs.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Aucun groupe.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Moyennes par classe (trimestre {data.trimestre})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Classe</TableHead><TableHead className="text-right">Moyenne</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.moyennes.byClasse
                  .filter((c) => !allowedClasseIds || allowedClasseIds.has(c.id))
                  .map((c) => (
                    <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right tabular-nums">{num(c.moyenne)}</TableCell></TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Moyennes par série (trimestre {data.trimestre})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Série</TableHead><TableHead className="text-right">Moyenne</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.moyennes.bySerie.map((s) => (
                  <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell className="text-right tabular-nums">{num(s.moyenne)}</TableCell></TableRow>
                ))}
                {data.moyennes.bySerie.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Aucune série.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Occupation des salles</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Heures / semaine</TableHead>
                  <TableHead className="text-right">Créneaux</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.salles.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.type ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.hoursPerWeek}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.entryCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              Heures brutes réservées, pas un taux d'occupation : aucune référence "heures disponibles" fiable n'existe
              pour la calculer sans l'inventer.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
