import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { TextInputField, DateField } from "@/components/form";

export interface PaymentFormValues {
  amount: string;
  paymentMode: string;
  paymentDate: string;
}

export const emptyPayment: PaymentFormValues = { amount: "", paymentMode: "", paymentDate: "" };

export const PaymentSchema = Yup.object({
  amount: Yup.number().typeError("Nombre requis.").positive("Doit être positif.").required("Le montant est requis."),
  paymentMode: Yup.string().optional(),
  paymentDate: Yup.string().optional(),
});

// Itération 57 (Étape 4, Vague 4) — extrait de TuitionPage.tsx/
// EnrollmentsPage.tsx : les deux fichiers portaient un mini-formulaire
// d'enregistrement de paiement STRICTEMENT identique (mêmes champs, même
// schéma Yup, même markup — visible dans leur `renderExpandedRow`), un
// doublon mécanique documenté à l'audit (§5 point 5 : "Duplication
// mécanique à fusionner"). Contrairement à `CoefficientForm.tsx`
// (itération 56, propre à `features/subjects/`), ce composant vit dans
// `components/` (pas `features/tuition/` ni `features/enrollments/`) car
// il n'appartient à aucun des deux modules — c'est un composant VRAIMENT
// partagé entre eux, comme `ConfirmDialog`/`FormDialog`. Comportement,
// validation et markup strictement inchangés — pur déplacement de code,
// avec `onSubmit` en prop à la place de la fermeture sur l'id de la
// ligne (chaque page fournit son propre `handleRecordPayment(id, …)`).
export function RecordPaymentForm({
  onSubmit,
}: {
  onSubmit: (values: PaymentFormValues, helpers: FormikHelpers<PaymentFormValues>) => void | Promise<void>;
}) {
  return (
    <Formik initialValues={emptyPayment} validationSchema={PaymentSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form className="flex flex-wrap items-end gap-2" noValidate>
          <TextInputField name="amount" label="Montant reçu" type="number" min="0" step="0.01" wrapperClassName="w-32" />
          <TextInputField name="paymentMode" label="Mode de paiement" placeholder="ex : Espèces" wrapperClassName="w-44" />
          <DateField name="paymentDate" label="Date" wrapperClassName="w-40" />
          <Button type="submit" variant="secondary" disabled={isSubmitting}>
            Enregistrer le paiement
          </Button>
        </Form>
      )}
    </Formik>
  );
}
