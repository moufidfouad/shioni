export function composeGroupeLabel(
  groupe: {
    name: string;
    classe: { name: string };
    serie: { name: string } | null;
  } | null,
): string | null {
  if (!groupe) return null;
  const serie = groupe.serie ? ` ${groupe.serie.name}` : "";
  return `${groupe.classe.name}${serie} / ${groupe.name}`;
}

export const groupeWithLabelSelect = {
  select: {
    id: true,
    name: true,
    classe: { select: { name: true } },
    serie: { select: { name: true } },
  },
} as const;
