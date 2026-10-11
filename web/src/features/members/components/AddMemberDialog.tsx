import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { SchoolRole } from "@/types";
import FormDialog from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { TextInputField, CheckboxGroupField } from "@/components/form";
import { ALL_ROLES } from "../roles";

export interface AddMemberValues {
  email: string;
  roles: SchoolRole[];
}

const initialValues: AddMemberValues = { email: "", roles: [] };

const AddMemberSchema = Yup.object({
  email: Yup.string().email("Email invalide.").required("L'email est requis."),
  roles: Yup.array().of(Yup.string().required()).min(1, "Sélectionnez au moins un rôle.").required(),
});

// Itération 56 (Étape 4, Vague 3) — extrait de SchoolMembersPage.tsx (audit
// §4.2 : "4 formulaires Formik distincts ... en un seul fichier → à
// décomposer"), comportement, validation et markup strictement inchangés.
// Suppose un compte déjà créé par la personne elle-même (contrairement aux
// trois dialogues "Créer un compte ..." ci-à-côté) — ne fait qu'attribuer des
// rôles.
export default function AddMemberDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AddMemberValues, helpers: FormikHelpers<AddMemberValues>) => void | Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajouter un utilisateur"
      description="La personne doit déjà avoir un compte (elle s'inscrit elle-même) — vous ne faites que lui attribuer des rôles dans cette école."
    >
      <Formik initialValues={initialValues} validationSchema={AddMemberSchema} onSubmit={onSubmit}>
        {({ isSubmitting }) => (
          <Form className="space-y-3" noValidate>
            <TextInputField
              name="email"
              label="Email"
              type="email"
              placeholder="email@exemple.com"
              wrapperClassName="max-w-sm"
            />
            <CheckboxGroupField name="roles" options={ALL_ROLES} />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ajout…" : "Attribuer les rôles"}
            </Button>
          </Form>
        )}
      </Formik>
    </FormDialog>
  );
}
