import { Classe, Serie } from "@/types";

export function groupeLabel(
  g: { name: string; classeId: string; serieId?: string | null },
  classes: Pick<Classe, "id" | "name">[],
  series: Pick<Serie, "id" | "name">[],
): string {
  const classeName = classes.find((c) => c.id === g.classeId)?.name ?? "?";
  const serieName = g.serieId ? series.find((s) => s.id === g.serieId)?.name : undefined;
  return `${classeName}${serieName ? ` ${serieName}` : ""} / ${g.name}`;
}

export function groupeLabelById(
  groupeId: string | null | undefined,
  groupes: { id: string; name: string; classeId: string; serieId?: string | null }[],
  classes: Pick<Classe, "id" | "name">[],
  series: Pick<Serie, "id" | "name">[],
  fallback?: string | null,
): string {
  const groupe = groupeId ? groupes.find((g) => g.id === groupeId) : undefined;
  if (!groupe) return fallback ?? "—";
  return groupeLabel(groupe, classes, series);
}
