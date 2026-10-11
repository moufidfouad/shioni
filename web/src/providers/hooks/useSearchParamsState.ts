import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Étape 4, Vague 1 (audit frontend Étape 1, §5 point 3 / §6 Should) — aucun
// filtre n'était synchronisé à l'URL nulle part dans l'application : un
// filtre de page perdait son état au rechargement/retour arrière et n'était
// jamais partageable par lien. Ce hook générique lit/écrit UN filtre dans
// les query params de l'URL courante, avec la même forme qu'un `useState`
// classique ([value, setValue]) — la source de vérité est l'URL elle-même,
// pas un state React dupliqué qu'il faudrait resynchroniser.
//
// `defaultValue` est traité comme "absence de filtre" : lire une clé
// absente renvoie `defaultValue`, et écrire `defaultValue` retire la clé de
// l'URL plutôt que de l'y stocker — évite de polluer l'URL avec `?classe=`
// quand "toutes les classes" (le défaut) est sélectionné.
//
// `{ replace: true }` sur chaque écriture : un filtre change souvent à
// chaque frappe/sélection, une entrée d'historique par changement rendrait
// le bouton "précédent" du navigateur inutilisable pour autre chose que
// défaire des filtres un par un.
//
// Ne convient pas quand plusieurs params doivent changer atomiquement dans
// un même geste (ex. réinitialiser un filtre enfant quand son parent
// change, voir AnalyticsPage.tsx qui compose directement `useSearchParams`
// pour ce cas précis) — un `useSearchParamsState` par clé suffit partout
// ailleurs, chaque filtre étant indépendant des autres.
export function useSearchParamsState(key: string, defaultValue = ""): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (!next || next === defaultValue) {
            params.delete(key);
          } else {
            params.set(key, next);
          }
          return params;
        },
        { replace: true }
      );
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}
