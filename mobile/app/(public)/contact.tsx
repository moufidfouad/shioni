import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useSendContactMessageMutation } from "@/src/api/publicContent";
import { showErrorToast, showSuccessToast } from "@/src/lib/toast";

// Écran Contact (itération 115) — équivalent mobile de
// frontend/src/pages/Contact.tsx : même route publique (`POST
// /public/contact`, voir src/api/publicContent.ts) et même schéma de
// validation que le web (Contact.tsx::ContactSchema), même patron Formik +
// Yup + toast que login.tsx/register.tsx (itération 71).
interface ContactValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const contactSchema = Yup.object({
  name: Yup.string().trim().min(2, "2 caractères minimum.").required("Champ requis."),
  email: Yup.string().trim().email("Email invalide.").required("Champ requis."),
  subject: Yup.string().trim().min(3, "3 caractères minimum.").required("Champ requis."),
  message: Yup.string().trim().min(10, "10 caractères minimum.").required("Champ requis."),
});

export default function ContactScreen() {
  const sendMessage = useSendContactMessageMutation();

  const formik = useFormik<ContactValues>({
    initialValues: { name: "", email: "", subject: "", message: "" },
    validationSchema: contactSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        await sendMessage.mutateAsync(values);
        showSuccessToast("Merci, votre message a bien été envoyé.");
        resetForm();
      } catch {
        showErrorToast("Impossible d'envoyer le message, réessayez plus tard.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Stack.Screen options={{ headerShown: true, title: "Contact" }} />

      <Text className="text-[22px] font-bold">Contact</Text>
      <Text className="mt-2 text-sm text-[#666]">
        Une question sur l'application ? Écrivez-nous et nous vous répondrons rapidement.
      </Text>

      <View className="mt-6">
        <TextInput
          className="mb-1 rounded-lg border border-[#d0d0d0] p-3 text-base"
          placeholder="Nom"
          value={formik.values.name}
          onChangeText={formik.handleChange("name")}
          onBlur={formik.handleBlur("name")}
        />
        {formik.touched.name && formik.errors.name && (
          <Text className="mb-2 text-xs text-[#c0392b]">{formik.errors.name}</Text>
        )}

        <TextInput
          className="mb-1 rounded-lg border border-[#d0d0d0] p-3 text-base"
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={formik.values.email}
          onChangeText={formik.handleChange("email")}
          onBlur={formik.handleBlur("email")}
        />
        {formik.touched.email && formik.errors.email && (
          <Text className="mb-2 text-xs text-[#c0392b]">{formik.errors.email}</Text>
        )}

        <TextInput
          className="mb-1 rounded-lg border border-[#d0d0d0] p-3 text-base"
          placeholder="Sujet"
          value={formik.values.subject}
          onChangeText={formik.handleChange("subject")}
          onBlur={formik.handleBlur("subject")}
        />
        {formik.touched.subject && formik.errors.subject && (
          <Text className="mb-2 text-xs text-[#c0392b]">{formik.errors.subject}</Text>
        )}

        <TextInput
          className="mb-1 min-h-[120px] rounded-lg border border-[#d0d0d0] p-3 text-base"
          placeholder="Message"
          multiline
          textAlignVertical="top"
          value={formik.values.message}
          onChangeText={formik.handleChange("message")}
          onBlur={formik.handleBlur("message")}
        />
        {formik.touched.message && formik.errors.message && (
          <Text className="mb-2 text-xs text-[#c0392b]">{formik.errors.message}</Text>
        )}

        <Pressable
          className="mt-2 items-center rounded-lg bg-[#1d4ed8] p-[14px]"
          onPress={() => formik.handleSubmit()}
          disabled={formik.isSubmitting}
        >
          {formik.isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Envoyer</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
