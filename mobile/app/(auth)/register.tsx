import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useAuthStore } from "@/src/store/authStore";
import { showErrorToast } from "@/src/lib/toast";

// Équivalent mobile de frontend/src/pages/RegisterPage.tsx — même contrat
// que registerSchema côté backend (email, password >= 8 caractères,
// fullName). `phone` volontairement omis pour cette Phase 1 (optionnel côté
// backend, voir auth.schema.ts::registerSchema) : à ajouter si le besoin se
// confirme, pas de raison de complexifier ce premier écran avant.
//
// Formik + Yup + toast (itération 71, voir mobile/README.md) — même patron
// que login.tsx : validation inline par champ, échec de soumission via toast.
//
// Itération 94 — QUATRIÈME écran migré vers NativeWind (après `settings.tsx`
// itération 90, `schools/index.tsx` itération 92, `login.tsx` itération 93) :
// `StyleSheet.create` → `className`, mêmes classes que `login.tsx` pour les
// styles partagés (container/input/fieldError/button/buttonText/link — les
// deux écrans avaient déjà des styles quasi identiques), seul `title` diffère
// (22px ici contre 28px + un sous-titre séparé sur login.tsx). Aucun
// changement de texte ni de comportement ; aucun flow Maestro ne couvre cet
// écran (voir `mobile/maestro/README.md`), donc rien à revérifier de ce
// côté.
const registerSchema = Yup.object({
  fullName: Yup.string().trim().required("Champ requis."),
  email: Yup.string().trim().email("Email invalide.").required("Champ requis."),
  password: Yup.string().min(8, "8 caractères minimum.").required("Champ requis."),
});

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  const formik = useFormik({
    initialValues: { fullName: "", email: "", password: "" },
    validationSchema: registerSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        await register(values.email.trim(), values.password, values.fullName.trim());
      } catch {
        // Voir le commentaire équivalent dans login.tsx : message déjà
        // extrait et posé dans authStore.error par le store.
        showErrorToast(useAuthStore.getState().error ?? "Impossible de créer le compte.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <View className="flex-1 justify-center bg-white p-6">
      {/* Itération 115 — voir le commentaire équivalent dans login.tsx. */}
      <Pressable className="mb-4 self-start" onPress={() => router.push("/(public)/landing")}>
        <Text className="text-sm text-[#1d4ed8]">← Accueil</Text>
      </Pressable>

      <Text className="mb-8 text-center text-[22px] font-bold">Créer un compte</Text>

      <TextInput
        className="mb-1 rounded-lg border border-[#d0d0d0] p-3 text-base"
        placeholder="Nom complet"
        value={formik.values.fullName}
        onChangeText={formik.handleChange("fullName")}
        onBlur={formik.handleBlur("fullName")}
      />
      {formik.touched.fullName && formik.errors.fullName && (
        <Text className="mb-2 text-xs text-[#c0392b]">{formik.errors.fullName}</Text>
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
        placeholder="Mot de passe (8 caractères minimum)"
        secureTextEntry
        value={formik.values.password}
        onChangeText={formik.handleChange("password")}
        onBlur={formik.handleBlur("password")}
      />
      {formik.touched.password && formik.errors.password && (
        <Text className="mb-2 text-xs text-[#c0392b]">{formik.errors.password}</Text>
      )}

      <Pressable
        className="mt-2 items-center rounded-lg bg-[#1d4ed8] p-[14px]"
        onPress={() => formik.handleSubmit()}
        disabled={formik.isSubmitting}
      >
        {formik.isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Créer le compte</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" className="mt-5 text-center text-[#1d4ed8]">
        J'ai déjà un compte
      </Link>
    </View>
  );
}
