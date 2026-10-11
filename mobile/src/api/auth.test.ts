import { AxiosError } from "axios";
import { extractErrorMessage } from "./auth";

// Phase 4 (itération 81) — le backend renvoie systématiquement
// `{ error: string }` sur une erreur (backend/src/middleware/
// errorHandler.ts) ; ce helper évite de laisser fuiter le message générique
// d'axios ("Request failed with status code 401") à l'écran.
function axiosErrorWith(data: unknown): AxiosError {
  const err = new AxiosError("Request failed");
  // @ts-expect-error — `response` est en lecture seule dans le typage
  // d'AxiosError, mais bien assignable à l'exécution (c'est ce que fait
  // axios lui-même en interne).
  err.response = { data, status: 400, statusText: "Bad Request", headers: {}, config: err.config };
  return err;
}

describe("extractErrorMessage", () => {
  it("extrait le message d'une AxiosError avec { error: string }", () => {
    expect(extractErrorMessage(axiosErrorWith({ error: "Identifiants invalides." }), "repli")).toBe(
      "Identifiants invalides."
    );
  });

  it("retombe sur le message de repli si la réponse n'a pas de champ error", () => {
    expect(extractErrorMessage(axiosErrorWith({ somethingElse: true }), "repli")).toBe("repli");
  });

  it("retombe sur le message de repli si la réponse est absente (hors ligne)", () => {
    expect(extractErrorMessage(new AxiosError("Network Error"), "repli")).toBe("repli");
  });

  it("retombe sur le message de repli pour une erreur qui n'est pas une AxiosError", () => {
    expect(extractErrorMessage(new Error("boom"), "repli")).toBe("repli");
    expect(extractErrorMessage("chaîne brute", "repli")).toBe("repli");
    expect(extractErrorMessage(null, "repli")).toBe("repli");
  });
});
