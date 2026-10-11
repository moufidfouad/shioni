import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { usePublicTestimonialsQuery } from "@/src/api/publicContent";
import { Testimonial } from "@/src/types";

// Écran Landing (itération 115) — équivalent mobile condensé de
// frontend/src/pages/LandingPage.tsx, NOUVEAU point d'entrée de l'app pour
// un utilisateur non connecté (voir app/index.tsx et (public)/_layout.tsx) :
// jusqu'ici l'app n'avait aucun écran public, "/" menait directement à
// (auth)/login. Contenu délibérément condensé plutôt qu'une simple
// retranscription du web : pas de bannière à formes floutées/dégradés
// (`FadeIn`/`StaggerContainer`, motion web absente côté mobile, non porté
// ici — écran statique), pas d'icône par fonctionnalité (ce projet mobile
// n'a AUCUNE librairie d'icônes, voir mobile/README.md — texte simple,
// comme partout ailleurs dans l'app), témoignages en liste horizontale
// défilante (`FlatList`) plutôt qu'un carrousel animé.
const FEATURES: { title: string; description: string }[] = [
  { title: "Élèves & inscriptions", description: "Inscriptions, classes, niveaux de frais et suivi des dossiers." },
  { title: "Notes & bulletins", description: "Saisie des notes et bulletins avec moyennes calculées automatiquement." },
  { title: "Présences", description: "Suivi des présences, absences et retards, classe par classe." },
  { title: "Finances & écolage", description: "Recettes, charges et suivi précis des paiements d'écolage." },
  { title: "Emploi du temps", description: "Une grille horaire par classe et par enseignant." },
  { title: "Messagerie", description: "Conversations privées ou de groupe, entre équipes, enseignants, parents et élèves." },
  { title: "Portails Parent & Élève", description: "Un espace dédié pour suivre bulletins, présences et paiements." },
  { title: "Multi-écoles & rôles", description: "Plusieurs établissements, des rôles précis pour chaque membre." },
];

export default function LandingScreen() {
  const router = useRouter();
  const testimonialsQuery = usePublicTestimonialsQuery();
  const testimonials = testimonialsQuery.data ?? [];

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero */}
      <View className="bg-[#eef2ff] px-6 pb-10 pt-16">
        <Text className="text-center text-xs font-medium text-[#1d4ed8]">
          Conçue aux Comores, pour les écoles comoriennes
        </Text>
        <Text className="mt-4 text-center text-[28px] font-bold">SHIONI</Text>
        <Text className="mt-2 text-center text-base text-[#444]">
          Pilotez vos écoles depuis une seule application
        </Text>
        <Text className="mx-2 mt-4 text-center text-sm text-[#666]">
          Élèves, notes, présences, finances, emploi du temps et messagerie : une application unique pour piloter
          plusieurs établissements, avec des portails dédiés pour les parents et les élèves.
        </Text>

        <View className="mt-6 gap-3">
          <Pressable
            className="items-center rounded-lg bg-[#1d4ed8] p-[14px]"
            onPress={() => router.push("/(auth)/register")}
          >
            <Text className="text-base font-semibold text-white">Créer un compte gratuitement</Text>
          </Pressable>
          <Pressable
            className="items-center rounded-lg border border-[#1d4ed8] p-[14px]"
            onPress={() => router.push("/(auth)/login")}
          >
            <Text className="text-base font-semibold text-[#1d4ed8]">Se connecter</Text>
          </Pressable>
        </View>

        <View className="mt-6 flex-row justify-center gap-6">
          <Link href="/(public)/about" className="text-sm font-medium text-[#1d4ed8]">
            À propos
          </Link>
          <Link href="/(public)/contact" className="text-sm font-medium text-[#1d4ed8]">
            Contact
          </Link>
        </View>
      </View>

      {/* Fonctionnalités */}
      <View className="px-6 py-8">
        <Text className="text-center text-lg font-semibold">Tout ce qu'il faut pour gérer un établissement</Text>
        <View className="mt-6 gap-3">
          {FEATURES.map((f) => (
            <View key={f.title} className="rounded-[10px] bg-[#f5f7fa] p-4">
              <Text className="text-[15px] font-semibold">{f.title}</Text>
              <Text className="mt-1 text-sm text-[#666]">{f.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Témoignages — alimentés par la même route publique que le web
          (/public/testimonials, voir src/api/publicContent.ts). Section
          entière masquée si vide/en erreur, même principe que
          frontend/src/features/testimonials/components/TestimonialsCarousel.tsx :
          contenu non essentiel sur un écran marketing. */}
      {!testimonialsQuery.isError && testimonials.length > 0 && (
        <View className="border-t border-[#eee] py-8">
          <Text className="px-6 text-center text-lg font-semibold">Ils utilisent SHIONI</Text>
          <FlatList
            horizontal
            data={testimonials}
            keyExtractor={(t) => t.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 24, paddingTop: 16 }}
            renderItem={({ item }) => <TestimonialCard testimonial={item} />}
          />
        </View>
      )}

      {/* CTA final */}
      <View className="items-center px-6 py-8">
        <Text className="text-center text-lg font-semibold">Prêt à démarrer ?</Text>
        <Text className="mt-2 text-center text-sm text-[#666]">
          Créez votre compte et ajoutez votre première école en quelques minutes.
        </Text>
        <Pressable
          className="mt-4 items-center rounded-lg bg-[#1d4ed8] px-6 py-[14px]"
          onPress={() => router.push("/(auth)/register")}
        >
          <Text className="text-base font-semibold text-white">Créer mon compte</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <View className="w-64 rounded-[10px] bg-[#eef2ff] p-4">
      <Text className="text-sm italic text-[#444]" numberOfLines={5}>
        « {testimonial.content} »
      </Text>
      <Text className="mt-3 text-sm font-semibold">{testimonial.authorName}</Text>
      <Text className="text-xs text-[#666]">{testimonial.authorRole}</Text>
    </View>
  );
}
