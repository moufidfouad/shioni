import { cn } from "@/lib/utils";
import type { AttendanceStatus, EndOfYearDecisionType, FeeStatus } from "../types";

// Convention unique statut → tonalité pour toute l'application (itération 26).
// Avant cette refonte, chaque page qui affichait un statut réinventait sa
// propre correspondance vers les variantes génériques de <Badge> (voir
// EnrollmentsPage.tsx::statusVariant et AttendancePage.tsx::statusVariant,
// tous deux supprimés au profit de ce fichier) — avec des choix incohérents
// d'une page à l'autre (ex: "Soldé" en bleu primaire ici, "Présent" en bleu
// primaire là, aucun des deux n'utilisant un vert de succès). Un seul point
// de vérité ici, réutilisable par tout futur module qui affiche un statut.
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "border-transparent bg-success/15 text-success",
  warning: "border-transparent bg-warning/20 text-warning-foreground",
  danger: "border-transparent bg-destructive/15 text-destructive",
  info: "border-transparent bg-info/15 text-info",
  neutral: "border-transparent bg-muted text-muted-foreground",
};

const TONE_DOT: Record<BadgeTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

/**
 * Badge de statut générique : un point de couleur + un libellé, tonalité
 * choisie parmi un jeu fermé (jamais une couleur arbitraire par page). Les
 * wrappers ci-dessous (`FeeStatusBadge`, `AttendanceStatusBadge`,
 * `PresenceRateBadge`) sont la façon normale de l'utiliser — préférer
 * un nouveau wrapper dédié à un futur domaine plutôt que d'appeler
 * `StatusBadge` avec une tonalité choisie au cas par cas dans une page.
 */
export function StatusBadge({ tone, label, className }: { tone: BadgeTone; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}

const FEE_STATUS: Record<FeeStatus, { label: string; tone: BadgeTone }> = {
  SOLDE: { label: "Soldé", tone: "success" },
  PARTIEL: { label: "Partiel", tone: "warning" },
  IMPAYE: { label: "Impayé", tone: "danger" },
};

export function FeeStatusBadge({ status, className }: { status: FeeStatus; className?: string }) {
  const { label, tone } = FEE_STATUS[status];
  return <StatusBadge tone={tone} label={label} className={className} />;
}

const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: BadgeTone }> = {
  PRESENT: { label: "Présent", tone: "success" },
  RETARD: { label: "Retard", tone: "warning" },
  ABSENT: { label: "Absent", tone: "danger" },
};

export function AttendanceStatusBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  const { label, tone } = ATTENDANCE_STATUS[status];
  return <StatusBadge tone={tone} label={label} className={className} />;
}

// Taux de présence : pas un statut catégoriel mais un seuil (déjà utilisé
// dans AttendancePage.tsx et le Tableau de bord) — mêmes tonalités success/
// warning/danger pour rester visuellement cohérent avec les badges de statut
// ci-dessus, plutôt qu'un dégradé de couleur distinct.
export function PresenceRateBadge({ rate, className }: { rate: number; className?: string }) {
  const tone: BadgeTone = rate >= 90 ? "success" : rate >= 75 ? "warning" : "danger";
  return <StatusBadge tone={tone} label={`${rate.toFixed(0)} %`} className={className} />;
}

// Itération 43 — décisions de fin d'année. PASSAGE en succès (résultat
// positif), REDOUBLEMENT en avertissement (pas un échec de l'élève à
// afficher en "danger", juste un signal d'attention), DEPART en neutre
// (étiquette informative, sans effet technique — voir schema.prisma), et
// REORIENTATION en info (changement d'orientation, ni positif ni négatif).
const END_OF_YEAR_DECISION: Record<EndOfYearDecisionType, { label: string; tone: BadgeTone }> = {
  PASSAGE: { label: "Passage", tone: "success" },
  REDOUBLEMENT: { label: "Redoublement", tone: "warning" },
  DEPART: { label: "Départ", tone: "neutral" },
  REORIENTATION: { label: "Réorientation", tone: "info" },
};

export function EndOfYearDecisionBadge({
  decision,
  className,
}: {
  decision: EndOfYearDecisionType;
  className?: string;
}) {
  const { label, tone } = END_OF_YEAR_DECISION[decision];
  return <StatusBadge tone={tone} label={label} className={className} />;
}

// Statut d'un membre du personnel (PersonnelPage.tsx) : un vrai état (qui
// change dans le temps), contrairement par ex. au type Obligatoire/
// Optionnelle d'une matière (une catégorie fixe, qui reste un <Badge> neutre
// ordinaire) — remplace l'ancien "statutVariant()" local à la page.
const STAFF_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  Actif: { label: "Actif", tone: "success" },
  Congé: { label: "Congé", tone: "warning" },
  Inactif: { label: "Inactif", tone: "danger" },
};

export function StaffStatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STAFF_STATUS[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return <StatusBadge tone={entry.tone} label={entry.label} className={className} />;
}

// Mention d'un bulletin (GradesPage.tsx) : un résultat calculé côté serveur
// à partir de la moyenne générale (donc un état, pas une catégorie figée) —
// remplace l'ancien "MENTION_VARIANT" local à la page.
const MENTION_STATUS: Record<string, { tone: BadgeTone }> = {
  Excellent: { tone: "success" },
  "Très bien": { tone: "success" },
  Bien: { tone: "info" },
  Passable: { tone: "warning" },
  Insuffisant: { tone: "danger" },
};

export function MentionBadge({ mention, className }: { mention: string; className?: string }) {
  const tone = MENTION_STATUS[mention]?.tone ?? "neutral";
  return <StatusBadge tone={tone} label={mention} className={className} />;
}
