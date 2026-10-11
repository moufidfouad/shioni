import { AxiosError } from "axios";
import { isNetworkError } from "./client";

// Phase 4 (itération 81) — distinction centrale du correctif de
// l'itération 76 (authStore.ts::bootstrap) : "aucune réponse reçue" (hors
// ligne) versus un échec applicatif réel (401, compte désactivé...). Voir
// le commentaire d'en-tête de client.ts.
describe("isNetworkError", () => {
  it("est vrai pour une AxiosError sans réponse (hors ligne)", () => {
    const err = new AxiosError("Network Error");
    expect(isNetworkError(err)).toBe(true);
  });

  it("est faux pour une AxiosError AVEC une réponse (401, 500...)", () => {
    const err = new AxiosError("Request failed");
    // @ts-expect-error — assignation directe, voir auth.test.ts.
    err.response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config: err.config };
    expect(isNetworkError(err)).toBe(false);
  });

  it("est faux pour une erreur qui n'est pas une AxiosError", () => {
    expect(isNetworkError(new Error("boom"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
