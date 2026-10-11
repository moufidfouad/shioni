import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import FormDialog from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/form";
import StudentMultiSelectField, { StudentOption } from "./StudentMultiSelectField";

export interface CreateParentValues {
  fullName: string;
  email: string;
  phone: string;
  studentIds: string[];
}

const parentInitialValues: CreateParentValues = { fullName: "", email: "", phone: "", studentIds: [] };

const CreateParentSchema = Yup.object({
  fullName: Yup.string().required("Le nom complet est requis."),
  email: Yup.string().email("Email invalide.").required("L'email est requis."),
  studentIds: Yup.array().of(Yup.string().required()).min(1, "Sélectionnez au moins un élève.").required(),
});

// Itération 56 (Étape 4, Vague 3) — extrait de SchoolMembersPage.tsx (audit
// §4.2), comportement, validation et markup strictement inchangés. Lie un ou
// plusieurs élèves via StudentGuardian (voir schema.prisma) ; un compte
// Parent n'a aucun SchoolRole — n'apparaîtra donc jamais dans la liste des
// membres de la page appelante.
export default function CreateParentAccountDialog({
  open,
  onOpenChange,
  studentOptions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentOptions: StudentOption[];
  onSubmit: (values: CreateParentValues, helpers: FormikHelpers<CreateParentValues>) => void | Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Créer un compte Parent"
      description="Donne un accès en lecture seule au portail Parent pour un ou plusieurs élèves. Un compte Parent n'a aucun rôle dans cette école : il n'apparaîtra jamais dans la liste des membres ci-dessous."
    >
      <Formik initialValues={parentInitialValues} validationSchema={CreateParentSchema} onSubmit={onSubmit}>
        {({ isSubmitting }) => (
          <Form className="space-y-3" noValidate>
            <TextInputField name="fullName" label="Nom complet" wrapperClassName="max-w-sm" />
            <TextInputField
              name="email"
              label="Email"
              type="email"
              placeholder="email@exemple.com"
              wrapperClassName="max-w-sm"
            />
            <TextInputField name="phone" label="Téléphone (optionnel)" wrapperClassName="max-w-sm" />
            <StudentMultiSelectField name="studentIds" options={studentOptions} />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Création…" : "Créer le compte Parent"}
            </Button>
          </Form>
        )}
      </Formik>
    </FormDialog>
  );
}
