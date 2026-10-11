import { useEffect, useState } from "react";

// Retourne `value`, mais mis à jour seulement après `delayMs` ms d'inactivité.
// Utilisé pour les champs de recherche texte qui alimentent une query React
// Query côté serveur (ex : liste des élèves) : évite une requête à chaque
// frappe tout en laissant React Query gérer le fetch/cache/annulation.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
