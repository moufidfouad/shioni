import { TextAreaField, TextInputField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Form, Formik, FormikHelpers } from "formik";
import { toast } from "sonner";
import * as Yup from "yup";
import { useSendContactMessageMutation } from "../api";

interface ContactValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const initialValues: ContactValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

const ContactSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, "2 caractères minimum")
    .required("Le nom est requis."),
  email: Yup.string().email("Email invalide.").required("L'email est requis."),
  subject: Yup.string()
    .trim()
    .min(3, "3 caractères minimum")
    .required("Le sujet est requis."),
  message: Yup.string()
    .trim()
    .min(10, "10 caractères minimum")
    .required("Le message est requis."),
});

export default function ContactForm() {
  const sendMessage = useSendContactMessageMutation();
  async function handleSubmit(
    values: ContactValues,
    helpers: FormikHelpers<ContactValues>,
  ) {
    try {
      await sendMessage.mutateAsync(values);
      toast.success("Merci, votre message a bien été envoyé.");
      helpers.resetForm();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          "Impossible d'envoyer le message, réessayez plus tard.",
      );
    } finally {
      helpers.setSubmitting(false);
    }
  }
  return (
    <Formik
      initialValues={initialValues}
      validationSchema={ContactSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting }) => (
        <Form className="space-y-4" noValidate>
          <TextInputField name="name" label="Nom" />
          <TextInputField name="email" label="Email" type="email" />
          <TextInputField name="subject" label="Sujet" />
          <TextAreaField name="message" label="Message" rows={5} />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Envoi…" : "Envoyer"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
