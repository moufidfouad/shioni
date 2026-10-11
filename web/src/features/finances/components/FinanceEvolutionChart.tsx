import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinanceMonthlyQuery } from "../api";
import { FinanceMonthlyPoint } from "@/types";

const MONTH_ABBR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const COLOR_RECETTES = "#2a78d6";
const COLOR_CHARGES = "#eb6834";

function formatCompact(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number, currency: string) {
  return `${value.toLocaleString("fr-FR")} ${currency}`;
}

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: TooltipContentProps & { currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as FinanceMonthlyPoint | undefined;
  if (!point) return null;
  const solde = point.totalRecettes - point.totalCharges;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      <p style={{ color: COLOR_RECETTES }}>
        Recettes : {formatCurrency(point.totalRecettes, currency)}
      </p>
      <p style={{ color: COLOR_CHARGES }}>
        Charges : {formatCurrency(point.totalCharges, currency)}
      </p>
      <p className="mt-1 text-muted-foreground">
        Solde : {formatCurrency(solde, currency)}
      </p>
    </div>
  );
}

// Graphique d'évolution mensuelle des finances (itération 18) — barres
// groupées Recettes/Charges par mois pour l'année sélectionnée, sur la
// feuille "TABLEAU DE BORD". Les 12 mois sont toujours présents (calculés
// côté service, mois sans écriture = 0) pour que l'axe X reste stable d'une
// année à l'autre. Le détail ligne par ligne reste consultable via la page
// Finances (DataTable) — ce graphique est un résumé, pas un substitut.
export default function FinanceEvolutionChart({
  schoolId,
  currency,
}: {
  schoolId: string;
  currency: string;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const query = useFinanceMonthlyQuery(schoolId, year);
  const points = query.data ?? [];
  const chartData = points.map((p) => ({
    ...p,
    monthLabel: MONTH_ABBR[p.month - 1],
  }));
  const hasData = points.some((p) => p.totalRecettes > 0 || p.totalCharges > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          Évolution mensuelle des finances
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="finance-chart-year"
            className="text-xs text-muted-foreground"
          >
            Année
          </Label>
          <Input
            id="finance-chart-year"
            type="number"
            className="h-8 w-24"
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value) || new Date().getFullYear())
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune écriture financière enregistrée pour {year}.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                barGap={2}
                barCategoryGap="20%"
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={formatCompact}
                />
                <Tooltip
                  content={(props) => (
                    <CustomTooltip {...props} currency={currency} />
                  )}
                  cursor={{ fill: "var(--accent)" }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  }}
                  formatter={(value) => (
                    <span style={{ color: "var(--foreground)" }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="totalRecettes"
                  name="Recettes"
                  fill={COLOR_RECETTES}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="totalCharges"
                  name="Charges"
                  fill={COLOR_CHARGES}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
            <Link
              to="finances"
              className="mt-2 inline-block text-xs text-primary hover:underline"
            >
              Voir le détail dans Finances →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
