// Itération 90 — n'existait pas jusqu'ici (Expo utilisait sa config Metro
// par défaut, implicite). NativeWind a besoin d'envelopper la config Metro
// pour traiter `global.css` (voir tailwind.config.js pour le choix du
// design system) — aucune autre modification par rapport au comportement
// Expo par défaut.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
