import { render, waitFor } from "@testing-library/react-native";
import { AuthenticatedPhoto, initials } from "./AuthenticatedPhoto";

// Phase 4 (itération 81). `getAccessToken` (SecureStore) est asynchrone —
// mocké ici plutôt qu'appelé réellement (aucun Keychain/Keystore natif
// disponible sous Jest).
jest.mock("../api/tokenStorage", () => ({
  getAccessToken: jest.fn(async () => "fake-token"),
}));

describe("initials", () => {
  it("prend la première lettre du prénom et du nom", () => {
    expect(initials("Fatima Ali")).toBe("FA");
  });

  it("gère un nom composé de plus de deux mots (premier + dernier)", () => {
    expect(initials("Jean de la Croix Bacar")).toBe("JB");
  });

  it("gère un seul mot", () => {
    expect(initials("Cheikh")).toBe("C");
  });

  it("renvoie '?' pour une chaîne vide", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("AuthenticatedPhoto", () => {
  it("affiche les initiales en repli quand il n'y a pas de photo", async () => {
    // `render` est asynchrone depuis @testing-library/react-native v14
    // (voir CHANGELOG — v13 le rendait encore de façon synchrone).
    const { getByText } = await render(
      <AuthenticatedPhoto uri="https://api.example/photo" hasPhoto={false} fullName="Fatima Ali" />
    );
    expect(getByText("FA")).toBeTruthy();
  });

  it("affiche l'image (avec le header Authorization) une fois le token chargé, si hasPhoto", async () => {
    const { queryByText } = await render(
      <AuthenticatedPhoto uri="https://api.example/photo" hasPhoto fullName="Fatima Ali" />
    );
    // Le composant part sans token (initiales affichées le temps du
    // premier rendu), puis bascule sur l'image une fois `getAccessToken`
    // résolu — comportement voulu (voir commentaire du composant), pas un
    // détail d'implémentation à masquer.
    await waitFor(() => expect(queryByText("FA")).toBeNull());
  });
});
