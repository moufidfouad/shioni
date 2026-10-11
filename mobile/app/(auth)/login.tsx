import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useAuthStore } from "@/src/store/authStore";
import { showErrorToast } from "@/src/lib/toast";

// Écran de connexion — équivalent mobile de frontend/src/pages/LoginPage.tsx.
// `identifier` (pas `email`) : même champ que le web depuis l'itération 65
// (accepte email, numéro d'élève ou numéro de CIN, voir auth.schema.ts).
//
// Formik + Yup + toast (itération 71, voir mobile/README.md) : validation
// déclarative par champ (affichée inline sous chaque champ), échec de
// SOUMISSION (identifiants invalides, réseau...) affiché via toast plutôt
// qu'un <Text> d'erreur statique — authStore.error garde son rôle de source
// de vérité, ce composant se contente de le pousser vers un toast dès qu'il
// change.
//
// Itération 93 — TROISIÈME écran migré vers NativeWind (après `settings.tsx`
// à l'itération 90 et `schools/index.tsx` à l'itération 92) : `StyleSheet.
// create` → `className`, même convention (crochets pour les valeurs hors
// échelle Tailwind, classes standard seulement quand elles correspondent
// EXACTEMENT). Choisi ensuite car c'est le tout premier écran vu par tout
// utilisateur non connecté — haute visibilité, écran simple (formulaire +
// bouton), aucun comportement changé. Point vérifié avant d'écrire ce
// fichier (pas supposé) : le `<Link>` d'Expo Router rend en interne un
// `<Text>` React Native natif (`react_native_1.Text`, voir node_modules/
// expo-router/build/link/BaseExpoRouterLink.js) et lui transmet tous les
// props non consommés — dont `className` — donc `className` fonctionne sur
// `<Link>` exactement comme sur un `<Text>` normal, patché par le
// `cssInterop` de NativeWind.
const loginSchema = Yup.object({
  identifier: Yup.string().trim().required("Champ requis."),
  password: Yup.string().required("Champ requis."),
});

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const formik = useFormik({
    initialValues: { identifier: "superadmin@example.com", password: "Password@123!" },
    validationSchema: loginSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        await login(values.identifier.trim(), values.password);
        // Pas de navigation manuelle ici : le changement de `status` dans
        // authStore déclenche le <Redirect> de (auth)/_layout.tsx tout seul.
      } catch {
        // authStore a déjà extrait un message affichable (extractErrorMessage,
        // voir src/api/auth.ts) et l'a posé dans `error` AVANT de relancer —
        // on le relit plutôt que de dupliquer l'extraction ici.
        showErrorToast(useAuthStore.getState().error ?? "Identifiants invalides ou serveur injoignable.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <View className="flex-1 justify-center bg-white p-6">
      {/* Itération 115 — retour vers Landing (nouveau point d'entrée public,
          voir (public)/landing.tsx), pour ne pas laisser un visiteur venu
          d'ailleurs (ex. lien direct) sans issue si ce n'est pas l'écran
          qu'il cherchait. */}
      <Pressable className="mb-4 self-start" onPress={() => router.push("/(public)/landing")}>
        <Text className="text-sm text-[#1d4ed8]">← Accueil</Text>
      </Pressable>

      <Text className="mb-1 text-center text-[28px] font-bold">SHIONI</Text>
      <Text className="mb-8 text-center text-base text-[#666]">Connexion</Text>

      <TextInput
        className="mb-1 rounded-lg border border-[#d0d0d0] p-3 text-base"
        placeholder="Email, numéro d'élève ou CIN"
        autoCapitalize="none"
        autoCorrect={false}
        value={formik.values.identifier}
        onChangeText={formik.handleChange("identifier")}
        onBlur={formik.handleBlur("identifier")}
      />
      {formik.touched.identifier && formik.errors.identifier && (
        <Text className="mb-2 text-xs text-[#c0392b]">{formik.errors.identifier}</Text>
      )}

      <TextInput
        className="mb-1 rounded-lg border border-[#d0d0d0] p-3 text-base"
        placeholder="Mot de passe"
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
          <Text className="text-base font-semibold text-white">Se connecter</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" className="mt-5 text-center text-[#1d4ed8]">
        Créer un compte
      </Link>
    </View>
  );
}
