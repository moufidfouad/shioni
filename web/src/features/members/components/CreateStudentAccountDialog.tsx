import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import FormDialog from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { TextInputField, SelectField } from "@/components/form";
import { StudentOption } from "./StudentMultiSelectField";

export interface CreateStudentValues {
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
}

const studentAccountInitialValues: CreateStudentValues = { studentId: "", fullName: "", email: "", phone: "" };

const CreateStudentAccountSchema = Yup.object({
  studentId: Yup.string().required("Sélectionnez un élève."),
  fullName: Yup.string().required("Le nom complet est requis."),
  email: Yup.string().email("Email invalide.").required("L'email est requis."),
  phone: Yup.string().optional(),
});

// Itération 56 (Étape 4, Vague 3) — extrait de SchoolMembersPage.tsx (audit
// §4.2), comportement, validation et markup strictement inchangés.
// `studentOptions` est filtrée en amont par la page appelante : seuls les
// élèves pas encore liés à un compte (Student.userId nul, FK 1-1) — à ne pas
// confondre avec les options (plus larges) de `CreateParentAccountDialog`, où
// plusieurs parents peuvent être liés au même élève.
export default function CreateStudentAccountDialog({
  open,
  onOpenChange,
  studentOptions,
  studentsLoading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentOptions: StudentOption[];
  studentsLoading: boolean;
  onSubmit: (values: CreateStudentValues, helpers: FormikHelpers<CreateStudentValues>) => void | Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Créer un compte Élève"
      description="Donne à un élève un accès en lecture seule à son propre portail (bulletins, présences, frais de scolarité). Un compte Élève n'a aucun rôle dans cette école : il n'apparaîtra jamais dans la liste des membres ci-dessous."
    >
      {studentOptions.length === 0 && !studentsLoading ? (
        <p className="text-sm text-muted-foreground">
          Tous les élèves de cette école sont déjà liés à un compte, ou aucun élève n'existe encore.
        </p>
      ) : (
        <Formik initialValues={studentAccountInitialValues} validationSchema={CreateStudentAccountSchema} onSubmit={onSubmit}>
          {({ isSubmitting }) => (
            <Form className="space-y-3" noValidate>
              <SelectField
                name="studentId"
                label="Élève"
                options={studentOptions}
                placeholder="Sélectionner un élève…"
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
                {isSubmitting ? "Création…" : "Créer le compte Élève"}
              </Button>
            </Form>
          )}
        </Formik>
      )}
    </FormDialog>
  );
}
