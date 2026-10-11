import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { TextInputField, SelectField, DateField } from "@/components/form";
import { MONTH_LABELS } from "../months";

export interface TuitionFormValues {
  studentId: string;
  schoolYearId: string;
  month: string;
  amountDue: string;
  amountPaid: string;
  discountAmount: string;
  discountReason: string;
  paymentMode: string;
  paymentDate: string;
}

export const TuitionSchema = Yup.object({
  studentId: Yup.string().required("Choisissez un élève."),
  schoolYearId: Yup.string().required("L'année scolaire est requise."),
  month: Yup.number().typeError("Mois requis.").min(1).max(12).required("Le mois est requis."),
  amountDue: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").required("Le montant dû est requis."),
  amountPaid: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
  discountAmount: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
  discountReason: Yup.string()
    .trim()
    .max(500, "500 caractères maximum.")
    .when("discountAmount", {
      is: (v: string) => Number(v) > 0,
      then: (schema) => schema.required("Précisez le motif de la réduction accordée."),
    }),
  paymentMode: Yup.string().optional(),
  paymentDate: Yup.string().optional(),
});

// Itération 57 (Étape 4, Vague 4) — extrait de TuitionPage.tsx (audit §7 :
// "Tuition (plus gros composant à décomposer)"). Comportement, validation
// et markup strictement inchangés — pur déplacement de code.
export function TuitionFeeForm({
  editingId,
  initialValues,
  students,
  schoolYears,
  onSubmit,
  onCancel,
}: {
  editingId: string | null;
  initialValues: TuitionFormValues;
  students: { id: string; fullName: string; matricule: string }[];
  schoolYears: { id: string; label: string }[];
  onSubmit: (values: TuitionFormValues, helpers: FormikHelpers<TuitionFormValues>) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Formik key={editingId ?? "create"} initialValues={initialValues} validationSchema={TuitionSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SelectField
              name="studentId"
              label="Élève"
              placeholder="Choisir un élève…"
              searchPlaceholder="Rechercher un élève…"
              disabled={Boolean(editingId)}
              options={students.map((s) => ({ value: s.id, label: `${s.fullName} (${s.matricule})` }))}
              wrapperClassName="col-span-2"
            />
            <SelectField
              name="schoolYearId"
              label="Année scolaire"
              placeholder="Choisir une année…"
              disabled={Boolean(editingId)}
              options={schoolYears.map((y) => ({ value: y.id, label: y.label }))}
            />
            <SelectField
              name="month"
              label="Mois"
              placeholder="Choisir un mois…"
              disabled={Boolean(editingId)}
              options={MONTH_LABELS.map(([m, label]) => ({ value: String(m), label }))}
            />
            <TextInputField name="amountDue" label="Montant dû" type="number" min="0" />
            <TextInputField name="amountPaid" label="Déjà payé" type="number" min="0" />
            <TextInputField name="discountAmount" label="Réduction accordée" type="number" min="0" placeholder="0" />
            <TextInputField
              name="discountReason"
              label="Motif de la réduction"
              placeholder="ex : fratrie, bourse, enfant du personnel…"
              wrapperClassName="col-span-2"
            />
            <TextInputField name="paymentMode" label="Mode de paiement" placeholder="ex : Espèces, Mobile Money" />
            <DateField name="paymentDate" label="Date de paiement" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : editingId ? "Enregistrer" : "Créer"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
