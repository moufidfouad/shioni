import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import FormDialog from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { TextInputField, SelectField } from "@/components/form";

export interface CreateTeacherValues {
  staffMemberId: string;
  email: string;
  fullName: string;
  phone: string;
}

const teacherInitialValues: CreateTeacherValues = { staffMemberId: "", email: "", fullName: "", phone: "" };

const CreateTeacherSchema = Yup.object({
  staffMemberId: Yup.string().required("Sélectionnez une fiche Personnel."),
  fullName: Yup.string().required("Le nom complet est requis."),
  email: Yup.string().email("Email invalide.").required("L'email est requis."),
  phone: Yup.string().optional(),
});

export interface StaffOption {
  value: string;
  label: string;
}

// Itération 56 (Étape 4, Vague 3) — extrait de SchoolMembersPage.tsx (audit
// §4.2), comportement, validation et markup strictement inchangés. Lie une
// fiche Personnel existante (`staffOptions`, filtrée en amont par la page :
// seules les fiches sans compte lié) à un nouveau compte de connexion.
export default function CreateTeacherAccountDialog({
  open,
  onOpenChange,
  staffOptions,
  staffLoading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffOptions: StaffOption[];
  staffLoading: boolean;
  onSubmit: (values: CreateTeacherValues, helpers: FormikHelpers<CreateTeacherValues>) => void | Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Créer un compte Enseignant"
      description="Lie une fiche Personnel existante à un nouveau compte de connexion — la personne obtient le rôle Enseignant dans cette école et un mot de passe temporaire à lui communiquer."
    >
      {staffOptions.length === 0 && !staffLoading ? (
        <p className="text-sm text-muted-foreground">
          Toutes les fiches Personnel de cette école sont déjà liées à un compte, ou aucune fiche n'existe encore.
        </p>
      ) : (
        <Formik initialValues={teacherInitialValues} validationSchema={CreateTeacherSchema} onSubmit={onSubmit}>
          {({ isSubmitting }) => (
            <Form className="space-y-3" noValidate>
              <SelectField
                name="staffMemberId"
                label="Fiche Personnel"
                options={staffOptions}
                placeholder="Sélectionner un membre du personnel…"
                wrapperClassName="max-w-sm"
              />
              <TextInputField name="fullName" label="Nom complet" wrapperClassName="max-w-sm" />
              <TextInputField
                name="email"
                label="Email"
                type="email"
                placeholder="email@exemple.com"
                wrapperClassName="max-w-sm"
              />
              <TextInputField name="phone" label="Téléphone (optionnel)" wrapperClassName="max-w-sm" />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Création…" : "Créer le compte Enseignant"}
              </Button>
            </Form>
          )}
        </Formik>
      )}
    </FormDialog>
  );
}
