import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { changePasswordRequest } from "../api";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/form";


interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const initialValues: ChangePasswordValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const ChangePasswordSchema = Yup.object({
  currentPassword: Yup.string().required("Le mot de passe actuel est requis."),
  newPassword: Yup.string()
    .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères.")
    .required("Le nouveau mot de passe est requis."),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Les mots de passe ne correspondent pas.")
    .required("Merci de confirmer le nouveau mot de passe."),
});

export default function ChangePasswordForm() {
  async function handleSubmit(
    values: ChangePasswordValues,
    helpers: FormikHelpers<ChangePasswordValues>,
  ) {
    try {
      await changePasswordRequest(values.currentPassword, values.newPassword);
      toast.success("Mot de passe modifié.");
      helpers.resetForm();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Impossible de changer le mot de passe.",
      );
    } finally {
      helpers.setSubmitting(false);
    }
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={ChangePasswordSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting }) => (
        <Form className="space-y-4" noValidate>
          <TextInputField
            name="currentPassword"
            label="Mot de passe actuel"
            type="password"
          />
          <TextInputField
            name="newPassword"
            label="Nouveau mot de passe"
            type="password"
          />
          <TextInputField
            name="confirmPassword"
            label="Confirmer le nouveau mot de passe"
            type="password"
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Enregistrement…" : "Changer le mot de passe"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Mot de passe oublié ? Demandez à l'administrateur de votre école de
            le réinitialiser depuis la page "Utilisateurs & rôles".
          </p>
        </Form>
      )}
    </Formik>
  );
}
