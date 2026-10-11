import Toast from "react-native-toast-message";

// Helper toast partagé — convention établie à l'itération 71 (voir
// mobile/README.md) : TOUT formulaire mobile affiche ses erreurs/succès de
// SOUMISSION via un toast plutôt qu'un `<Text>` d'erreur statique en haut de
// l'écran. Les erreurs de VALIDATION par champ (Yup) restent, elles,
// affichées inline sous chaque champ — un toast par frappe serait une
// mauvaise expérience utilisateur ; seul l'échec de la soumission (réseau,
// 4xx serveur, etc.) déclenche un toast. Deux fonctions volontairement
// minimales : pas de configuration par appelant (titre, durée...), pour que
// tous les formulaires restent visuellement cohérents sans avoir à y penser.

export function showSuccessToast(message: string) {
  Toast.show({ type: "success", text1: message });
}

export function showErrorToast(message: string) {
  Toast.show({ type: "error", text1: message });
}
