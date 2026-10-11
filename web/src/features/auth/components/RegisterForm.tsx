import { Link, useNavigate } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { useAuth } from "@/providers/contexts/AuthContext/context";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/form";

interface RegisterValues {
  fullName: string;
  email: string;
  password: string;
}

const initialValues: RegisterValues = { fullName: "", email: "", password: "" };

const RegisterSchema = Yup.object({
  fullName: Yup.string()
    .trim()
    .min(2, "2 caractères minimum")
    .required("Le nom complet est requis."),
  email: Yup.string().email("Email invalide.").required("L'email est requis."),
  password: Yup.string()
    .min(8, "8 caractères minimum")
    .required("Le mot de passe est requis."),
});

export default function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(values: RegisterValues, helpers: FormikHelpers<RegisterValues>) {
    try {
      await register(values.email, values.password, values.fullName);
      navigate("/schools");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Inscription impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={RegisterSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting }) => (
        <Form className="space-y-4" noValidate>
          <TextInputField name="fullName" label="Nom complet" />
          <TextInputField name="email" label="Email" type="email" />
          <TextInputField
            name="password"
            label="Mot de passe"
            type="password"
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Création…" : "Créer mon compte"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
