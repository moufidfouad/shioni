import { ScrollView, Text, View } from "react-native";
import { Link, Stack } from "expo-router";

// Écran À propos (itération 115) — équivalent mobile condensé de
// frontend/src/pages/About.tsx, même principe que landing.tsx : pas
// d'icône par valeur (aucune librairie d'icônes dans ce projet mobile),
// texte + cartes simples.
const VALUES: { title: string; description: string }[] = [
  {
    title: "Multi-établissements",
    description:
      "Chaque organisation peut gérer plusieurs écoles indépendantes, chacune avec ses propres classes, niveaux de frais et membres.",
  },
  {
    title: "Rôles précis",
    description:
      "Administration, gestion des élèves, gestion des notes, gestion des finances, enseignants : chaque membre n'accède qu'à ce dont il a besoin.",
  },
  {
    title: "Pensé pour le quotidien",
    description: "Des listes claires et des formulaires validés pour les tâches répétées de la vie scolaire.",
  },
  {
    title: "Au-delà de la gestion",
    description:
      "Messagerie interne en temps réel, portails dédiés pour les parents et les élèves, et des ressources pédagogiques partagées publiquement.",
  },
];

export default function AboutScreen() {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Stack.Screen options={{ headerShown: true, title: "À propos" }} />

      <Text className="text-[22px] font-bold">À propos</Text>
      <Text className="mt-3 text-sm text-[#666]">
        SHIONI est une application conçue aux Comores pour les écoles comoriennes, afin de les aider à centraliser
        la gestion de leurs élèves, de leurs matières, de leurs notes, de leurs présences, de leur personnel, de
        leur emploi du temps et de leurs finances — jusqu'à la messagerie interne et des portails dédiés pour les
        parents et les élèves — au sein d'une seule plateforme, organisée école par école.
      </Text>

      <View className="mt-6 gap-3">
        {VALUES.map((v) => (
          <View key={v.title} className="rounded-[10px] bg-[#f5f7fa] p-4">
            <Text className="text-[15px] font-semibold">{v.title}</Text>
            <Text className="mt-1 text-sm text-[#666]">{v.description}</Text>
          </View>
        ))}
      </View>

      <Text className="mt-6 text-sm text-[#666]">
        Une question, une suggestion ? N'hésitez pas à nous écrire depuis la page{" "}
        <Link href="/(public)/contact" className="font-medium text-[#1d4ed8] underline">
          Contact
        </Link>
        .
      </Text>
    </ScrollView>
  );
}
