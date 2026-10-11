import { Link, useNavigate } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { useAuth } from "@/providers/contexts/AuthContext/context";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/form";

interface LoginValues {
  identifier: string;
  password: string;
}

const initialValues: LoginValues = {
  identifier: "directeur@ecole-excellence.km",
  password: "Password@123!",
};

const LoginSchema = Yup.object({
  identifier: Yup.string().trim().required("Ce champ est requis."),
  password: Yup.string().required("Le mot de passe est requis."),
});

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(
    values: LoginValues,
    helpers: FormikHelpers<LoginValues>,
  ) {
    try {
      await login(values.identifier, values.password);
      navigate("/schools");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Connexion impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={LoginSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting }) => (
        <Form className="space-y-4" noValidate>
          <TextInputField
            name="identifier"
            label="Identifiant"
            type="text"
            autoComplete="username"
            placeholder="Email, numéro d'élève (ministère)"
          />
          <TextInputField
            name="password"
            label="Mot de passe"
            type="password"
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
