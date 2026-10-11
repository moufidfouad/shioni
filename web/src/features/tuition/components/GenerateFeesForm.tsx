import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextInputField, SelectField } from "@/components/form";
import { groupeLabel } from "@/lib/groupeLabel";
import { MONTH_LABELS } from "../months";

export interface GenerateFormValues {
  schoolYearId: string;
  groupeId: string;
  discountAmount: string;
  discountReason: string;
}

export const GenerateSchema = Yup.object({
  schoolYearId: Yup.string().required("L'année scolaire est requise."),
  groupeId: Yup.string().optional(),
  discountAmount: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
  discountReason: Yup.string()
    .trim()
    .max(500, "500 caractères maximum.")
    .when("discountAmount", {
      is: (v: string) => Number(v) > 0,
      then: (schema) => schema.required("Précisez le motif de la réduction accordée."),
    }),
});

// Itération 57 (Étape 4, Vague 4) — extrait de TuitionPage.tsx (audit §7 :
// "Tuition (plus gros composant à décomposer)"). Comportement, validation
// et markup strictement inchangés — pur déplacement de code, avec des
// props explicites à la place des variables du scope de la page fermées
// implicitement. `selectedMonths`/`onToggleMonth` restent des props (pas
// des champs Formik) : ce choix — les mois à générer ne font pas partie des
// `values` du formulaire — est celui de l'implémentation d'origine,
// inchangé par cette extraction.
export function GenerateFeesForm({
  schoolYears,
  groupes,
  classes,
  series,
  defaultSchoolYearId,
  selectedMonths,
  onToggleMonth,
  onSubmit,
  onCancel,
}: {
  schoolYears: { id: string; label: string }[];
  groupes: { id: string; name: string; classeId: string; serieId?: string | null }[];
  classes: { id: string; name: string }[];
  series: { id: string; name: string }[];
  defaultSchoolYearId: string;
  selectedMonths: number[];
  onToggleMonth: (month: number) => void;
  onSubmit: (values: GenerateFormValues, helpers: FormikHelpers<GenerateFormValues>) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">
        Crée une ligne d'écolage par élève et par mois sélectionné, préremplie avec le tarif mensuel du niveau de
        chaque élève (Paramètres). Une ligne déjà existante pour un élève/mois n'est jamais recréée ni écrasée.
      </p>
      <Formik
        initialValues={{ schoolYearId: defaultSchoolYearId, groupeId: "", discountAmount: "", discountReason: "" }}
        validationSchema={GenerateSchema}
        onSubmit={onSubmit}
      >
        {({ isSubmitting }) => (
          <Form className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <SelectField
                name="schoolYearId"
                label="Année scolaire"
                placeholder="Choisir une année…"
                options={schoolYears.map((y) => ({ value: y.id, label: y.label }))}
              />
              <SelectField
                name="groupeId"
                label="Classe (optionnel — sinon toute l'école)"
                placeholder="Toute l'école"
                options={groupes.map((c) => ({ value: c.id, label: groupeLabel(c, classes, series) }))}
              />
              <TextInputField name="discountAmount" label="Réduction uniforme" type="number" min="0" placeholder="0" />
              <TextInputField
                name="discountReason"
                label="Motif de la réduction"
                placeholder="ex : fratrie, bourse…"
                wrapperClassName="col-span-2"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Mois à générer</p>
              <div className="flex flex-wrap gap-3">
                {MONTH_LABELS.map(([m, label]) => (
                  <label key={m} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={selectedMonths.includes(m)} onCheckedChange={() => onToggleMonth(m)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Génération…" : "Générer"}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Annuler
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
}
