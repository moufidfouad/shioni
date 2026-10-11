import { useMemo } from "react";
import { Formik, Form, FormikHelpers, useFormikContext } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { TextInputField, SelectField, DateField } from "@/components/form";

export interface EnrollmentFormValues {
  studentId: string;
  schoolYearId: string;
  feeDue: string;
  amountPaid: string;
  discountAmount: string;
  discountReason: string;
  paymentMode: string;
  paymentDate: string;
}

export const EnrollmentSchema = Yup.object({
  studentId: Yup.string().required("Choisissez un élève."),
  schoolYearId: Yup.string().required("L'année scolaire est requise."),
  feeDue: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").required("Les frais dus sont requis."),
  amountPaid: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
  discountAmount: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
  // Une réduction accordée doit toujours être justifiée (fratrie, bourse,
  // enfant du personnel...), pour qu'on puisse s'y retrouver plus tard —
  // voir le même contrôle côté serveur (enrollments.schema.ts).
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

// Affiche, sous le champ "Frais dus", le barème standard de la classe de
// l'élève sélectionné et le montant qui en résulterait une fois la
// réduction déduite — avec un bouton pour appliquer cette suggestion dans
// `feeDue`. `feeDue` reste par ailleurs un champ libre : cette aide ne
// force jamais la valeur, une négociation n'a pas toujours à suivre
// exactement le barème (voir le commentaire sur `Enrollment.discountAmount`
// dans schema.prisma).
function FeeLevelSuggestion({
  students,
  groupes,
  feeLevels,
  currency,
}: {
  students: { id: string; groupeId?: string | null }[];
  // Itération 35 — `classeId` remplace l'ancien `levelName` texte libre
  // (voir schema.prisma::FeeLevel/Groupe).
  groupes: { id: string; classeId?: string | null }[];
  feeLevels: { classeId: string; amount: string }[];
  currency: string;
}) {
  const { values, setFieldValue } = useFormikContext<EnrollmentFormValues>();

  const standardAmount = useMemo(() => {
    const student = students.find((s) => s.id === values.studentId);
    const groupe = groupes.find((c) => c.id === student?.groupeId);
    const feeLevel = feeLevels.find((f) => f.classeId === groupe?.classeId);
    return feeLevel ? Number(feeLevel.amount) : null;
  }, [students, groupes, feeLevels, values.studentId]);

  if (standardAmount === null) return null;

  const discount = Number(values.discountAmount) || 0;
  const suggested = Math.max(0, standardAmount - discount);

  return (
    <p className="col-span-2 -mt-2 text-xs text-muted-foreground sm:col-span-3">
      Barème de la classe : {standardAmount.toLocaleString("fr-FR")} {currency}
      {discount > 0 && ` — après réduction : ${suggested.toLocaleString("fr-FR")} ${currency}`}
      {" "}
      <button
        type="button"
        className="font-medium text-primary underline underline-offset-2"
        onClick={() => setFieldValue("feeDue", String(suggested))}
      >
        Utiliser ce montant
      </button>
    </p>
  );
}

// Itération 57 (Étape 4, Vague 4) — extrait de EnrollmentsPage.tsx (audit
// §7, même traitement que TuitionPage.tsx). Comportement, validation et
// markup strictement inchangés — pur déplacement de code, `FeeLevelSuggestion`
// inclus (doit rester dans l'arbre du `Formik` qui l'utilise via
// `useFormikContext`).
export function EnrollmentForm({
  editingId,
  initialValues,
  students,
  groupes,
  schoolYears,
  feeLevels,
  currency,
  onSubmit,
  onCancel,
}: {
  editingId: string | null;
  initialValues: EnrollmentFormValues;
  students: { id: string; fullName: string; matricule: string; groupeId?: string | null }[];
  groupes: { id: string; classeId?: string | null }[];
  schoolYears: { id: string; label: string }[];
  feeLevels: { classeId: string; amount: string }[];
  currency: string;
  onSubmit: (values: EnrollmentFormValues, helpers: FormikHelpers<EnrollmentFormValues>) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Formik key={editingId ?? "create"} initialValues={initialValues} validationSchema={EnrollmentSchema} onSubmit={onSubmit}>
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
              options={schoolYears.map((y) => ({ value: y.id, label: y.label }))}
            />
            <TextInputField name="feeDue" label="Frais dus" type="number" min="0" />
            <FeeLevelSuggestion students={students} groupes={groupes} feeLevels={feeLevels} currency={currency} />
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
