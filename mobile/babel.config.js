// Itération 90 — n'existait pas jusqu'ici (Expo utilisait sa config Babel
// par défaut, `babel-preset-expo` seul, implicite). NativeWind a besoin
// d'étendre ce preset (`jsxImportSource`) — voir
// https://www.nativewind.dev/getting-started/installation, aucune autre
// modification par rapport au comportement Expo par défaut.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
