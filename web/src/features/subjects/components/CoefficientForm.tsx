import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { TextInputField, SelectField } from "@/components/form";

export interface CoefficientFormValues {
  groupeId: string;
  coefficient: string;
  hoursPerWeek: string;
  teacherId: string;
}

export const emptyCoefficientValues: CoefficientFormValues = {
  groupeId: "",
  coefficient: "",
  hoursPerWeek: "",
  teacherId: "",
};

export const CoefficientSchema = Yup.object({
  groupeId: Yup.string().required("Choisissez une classe."),
  coefficient: Yup.number()
    .typeError("Nombre requis.")
    .min(0, "Doit être positif.")
    .required("Le coefficient est requis."),
  hoursPerWeek: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
  teacherId: Yup.string().optional(),
});

// Formulaire de MODIFICATION d'un coefficient déjà configuré : mêmes champs
// que CoefficientFormValues moins `groupeId` (fixé par la ligne éditée,
// jamais changé — changer de classe reviendrait à en configurer une autre).
export interface EditCoefficientFormValues {
  coefficient: string;
  hoursPerWeek: string;
  teacherId: string;
}

export const EditCoefficientSchema = Yup.object({
  coefficient: Yup.number()
    .typeError("Nombre requis.")
    .min(0, "Doit être positif.")
    .required("Le coefficient est requis."),
  hoursPerWeek: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
  teacherId: Yup.string().optional(),
});

export interface SelectOption {
  value: string;
  label: string;
}

// Itération 56 (Étape 4, Vague 3) — extrait de SubjectsPage.tsx (audit
// FRONTEND-AUDIT-ETAPE1.md §4.3 : "Formulaire de coefficient recréé en
// clôture à chaque rendu dans `renderExpandedRow` → à extraire"). Les deux
// formulaires ci-dessous (ajout d'un coefficient sur une classe pas encore
// configurée, modification d'un coefficient déjà configuré) vivaient jusque
// là comme de simples blocs JSX inline à l'intérieur de `renderExpandedRow`
// — une prop elle-même redéfinie à chaque rendu de la page, donc ces deux
// formulaires (schémas de validation, valeurs initiales, markup) étaient
// reconstruits en clôture à chaque rendu plutôt que d'être des composants
// stables. Comportement, validation et markup strictement inchangés — pur
// déplacement de code, plus des props explicites à la place des variables du
// scope de la page (`s`, `groupes`, `classes`, `series`, `staff`) fermées
// implicitement.
export function AddCoefficientForm({
  groupeOptions,
  teacherOptions,
  onSubmit,
}: {
  groupeOptions: SelectOption[];
  teacherOptions: SelectOption[];
  onSubmit: (values: CoefficientFormValues, helpers: FormikHelpers<CoefficientFormValues>) => void | Promise<void>;
}) {
  return (
    <Formik initialValues={emptyCoefficientValues} validationSchema={CoefficientSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form className="flex flex-wrap items-end gap-2" noValidate>
          <SelectField
            name="groupeId"
            label="Classe"
            placeholder="Choisir…"
            searchPlaceholder="Rechercher une classe…"
            options={groupeOptions}
            wrapperClassName="w-48"
          />
          <TextInputField name="coefficient" label="Coefficient" type="number" step="0.5" min="0" wrapperClassName="w-28" />
          <TextInputField name="hoursPerWeek" label="Heures/semaine" type="number" min="0" wrapperClassName="w-32" />
          <SelectField
            name="teacherId"
            label="Enseignant"
            clearable
            placeholder="Aucun"
            searchPlaceholder="Rechercher un membre du personnel…"
            options={teacherOptions}
            wrapperClassName="w-48"
          />
          <Button type="submit" variant="secondary" disabled={isSubmitting}>
            Ajouter
          </Button>
        </Form>
      )}
    </Formik>
  );
}

export function EditCoefficientForm({
  groupeLabel,
  initialValues,
  teacherOptions,
  onSubmit,
  onCancel,
}: {
  groupeLabel: string;
  initialValues: EditCoefficientFormValues;
  teacherOptions: SelectOption[];
  onSubmit: (values: EditCoefficientFormValues, helpers: FormikHelpers<EditCoefficientFormValues>) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Formik initialValues={initialValues} validationSchema={EditCoefficientSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form className="flex flex-wrap items-end gap-2" noValidate>
          <span className="pb-2 text-sm font-medium">{groupeLabel}</span>
          <TextInputField name="coefficient" label="Coefficient" type="number" step="0.5" min="0" wrapperClassName="w-28" />
          <TextInputField name="hoursPerWeek" label="Heures/semaine" type="number" min="0" wrapperClassName="w-32" />
          <SelectField
            name="teacherId"
            label="Enseignant"
            clearable
            placeholder="Aucun"
            searchPlaceholder="Rechercher un membre du personnel…"
            options={teacherOptions}
            wrapperClassName="w-48"
          />
          <Button type="submit" variant="secondary" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        </Form>
      )}
    </Formik>
  );
}
