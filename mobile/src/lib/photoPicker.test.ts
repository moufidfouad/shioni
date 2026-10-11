import { Alert } from "react-native";
import { presentPhotoSourceOptions } from "./photoPicker";

// Phase 4 (itération 81) — vérifie la composition des boutons de l'action
// combinée (Phase 3c, itération 80), en particulier le seul cas
// conditionnel : "Supprimer la photo" n'apparaît QUE si `canRemove` est vrai
// (une fiche sans photo n'a rien à supprimer).
describe("presentPhotoSourceOptions", () => {
  it("propose Caméra/Galerie/Annuler, sans Supprimer, si canRemove est faux", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    presentPhotoSourceOptions({ canRemove: false, onCamera: jest.fn(), onLibrary: jest.fn() });

    const buttons = spy.mock.calls[0][2] as { text: string }[];
    expect(buttons.map((b) => b.text)).toEqual(["Prendre une photo", "Choisir depuis la galerie", "Annuler"]);
    spy.mockRestore();
  });

  it("ajoute Supprimer la photo (en avant-dernier) si canRemove est vrai", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    presentPhotoSourceOptions({ canRemove: true, onCamera: jest.fn(), onLibrary: jest.fn(), onRemove: jest.fn() });

    const buttons = spy.mock.calls[0][2] as { text: string }[];
    expect(buttons.map((b) => b.text)).toEqual([
      "Prendre une photo",
      "Choisir depuis la galerie",
      "Supprimer la photo",
      "Annuler",
    ]);
    spy.mockRestore();
  });

  it("déclenche le bon callback pour chaque bouton", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const onCamera = jest.fn();
    const onLibrary = jest.fn();
    const onRemove = jest.fn();
    presentPhotoSourceOptions({ canRemove: true, onCamera, onLibrary, onRemove });

    const buttons = spy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Prendre une photo")?.onPress?.();
    buttons.find((b) => b.text === "Choisir depuis la galerie")?.onPress?.();
    buttons.find((b) => b.text === "Supprimer la photo")?.onPress?.();

    expect(onCamera).toHaveBeenCalledTimes(1);
    expect(onLibrary).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  // Itération 112 — `onDocument` (Messagerie uniquement, voir
  // messaging/[conversationId]/index.tsx::openAttachmentOptions) ajoute un
  // bouton "Choisir un document" et change le titre de l'Alert. Aucun des
  // trois tests ci-dessus (EditablePhoto.tsx, jamais `onDocument`) n'est
  // affecté : ce comportement reste strictement additif.
  it("ajoute Choisir un document (avant Supprimer/Annuler) et change le titre si onDocument est fourni", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    presentPhotoSourceOptions({
      canRemove: false,
      onCamera: jest.fn(),
      onLibrary: jest.fn(),
      onDocument: jest.fn(),
    });

    expect(spy.mock.calls[0][0]).toBe("Pièce jointe");
    const buttons = spy.mock.calls[0][2] as { text: string }[];
    expect(buttons.map((b) => b.text)).toEqual([
      "Prendre une photo",
      "Choisir depuis la galerie",
      "Choisir un document",
      "Annuler",
    ]);
    spy.mockRestore();
  });

  it("déclenche onDocument quand son bouton est pressé", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const onDocument = jest.fn();
    presentPhotoSourceOptions({ canRemove: false, onCamera: jest.fn(), onLibrary: jest.fn(), onDocument });

    const buttons = spy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Choisir un document")?.onPress?.();

    expect(onDocument).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
