import { useCallback, useState } from "react";


export function useLocalStorage(
  key: string,
  initialValue: string,
  serialize: (value: string) => string = (v) => v,
  deserialize: (raw: string) => string = (raw) => raw
): [string, (value: string | ((prev: string) => string)) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initialValue : deserialize(raw);
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = useCallback(
    (next: string | ((prev: string) => string)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: string) => string)(prev) : next;
        try {
          localStorage.setItem(key, serialize(resolved));
        } catch {
          // Stockage indisponible (navigation privée, quota, etc.) : la
          // préférence reste simplement non mémorisée, sans casser la page.
        }
        return resolved;
      });
    },
    [key, serialize]
  );

  return [value, setStoredValue];
}

// Variante pratique pour le cas le plus courant (booléen stocké en "1"/"0",
// exactement le format déjà utilisé par SIDEBAR_COLLAPSED_KEY) — évite à
// chaque appelant de récrire les mêmes fonctions serialize/deserialize.
export function useLocalStorageBoolean(key: string, initialValue = false): [boolean, (value: boolean | ((prev: boolean) => boolean)) => void] {
  const [raw, setRaw] = useLocalStorage(
    key,
    initialValue ? "1" : "0"
  );
  const setBool = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setRaw((prevRaw) => {
        const prevBool = prevRaw === "1";
        const resolved = typeof next === "function" ? (next as (prev: boolean) => boolean)(prevBool) : next;
        return resolved ? "1" : "0";
      });
    },
    [setRaw]
  );
  return [raw === "1", setBool];
}
