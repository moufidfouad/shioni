export const MONTH_LABELS: [number, string][] = [
  [1, "Janvier"],
  [2, "Février"],
  [3, "Mars"],
  [4, "Avril"],
  [5, "Mai"],
  [6, "Juin"],
  [7, "Juillet"],
  [8, "Août"],
  [9, "Septembre"],
  [10, "Octobre"],
  [11, "Novembre"],
  [12, "Décembre"],
];

export function monthLabel(month: number) {
  return MONTH_LABELS.find(([m]) => m === month)?.[1] ?? String(month);
}
