// Itération 90 — choix du design system délégué par l'utilisateur (« je
// vous laisse le choix de ce cadrage », itération 87 ; confirmé
// explicitement à cette itération). NativeWind (Tailwind CSS pour React
// Native) retenu plutôt que Tamagui ou React Native Paper, pour la MÊME
// raison que le choix déjà fait côté web (voir claude/architecture-et-
// avancement.md, "Décisions prises" : Tailwind CSS v4 + shadcn/ui) — garder
// un seul mental model utilitaire (classes Tailwind) entre web et mobile,
// plutôt qu'introduire un DEUXIÈME système de design radicalement différent
// (composants Material de RN Paper, ou les tokens/compilateur de Tamagui).
//
// `tailwindcss@3.4.19` (PAS v4, contrairement au web) : NativeWind v4.x
// s'appuie sur le format de config JS classique de Tailwind v3
// (`content`/`presets`), pas le nouveau format CSS-first (`@theme`) de
// Tailwind v4 — package MOBILE indépendant du package FRONTEND (deux
// `package.json` distincts, deux toolchains distinctes, Metro vs Vite),
// aucun conflit avec le choix v4 du web.
//
// Versions ÉPINGLÉES explicitement (`nativewind@4.2.7`, `tailwindcss@3.4.19`,
// voir package.json) — même précaution que le correctif itération 79
// (`react-native-mmkv` réinstallé en v4 malgré un épinglage insuffisant) :
// une plage semver ouverte sur une dépendance aussi structurelle
// (babel/metro) serait risquée à ne pas pouvoir vérifier visuellement dans
// ce bac à sable.
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
