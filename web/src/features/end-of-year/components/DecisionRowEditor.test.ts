import { describe, expect, it } from "vitest";
import { needsEnrollmentYear, needsTargetGroupe } from "./DecisionRowEditor";

// Étape 4, Vague 6 — ces deux fonctions pilotent DIRECTEMENT le correctif de
// sécurité "Must" de l'audit livré en itération 57 : dans EndOfYearPage.tsx,
// la confirmation (ConfirmDialog) avant d'enregistrer une décision est
// demandée exactement quand `needsTargetGroupe(decision) ||
// needsEnrollmentYear(decision)` est vrai (voir EndOfYearPage.tsx, fonction
// `handleSave`). Une régression sur l'une de ces deux fonctions romprait
// silencieusement la garde de confirmation pour PASSAGE, REDOUBLEMENT ou
// REORIENTATION — exactement le risque métier que l'itération 57 a fermé.
// C'est le test le plus critique de toute la Vague 6 : il protège
// directement contre la réapparition du bug "Must" original.

describe("needsTargetGroupe", () => {
  it("est vrai pour PASSAGE et REORIENTATION (décisions qui déplacent l'élève de classe)", () => {
    expect(needsTargetGroupe("PASSAGE")).toBe(true);
    expect(needsTargetGroupe("REORIENTATION")).toBe(true);
  });

  it("est faux pour REDOUBLEMENT et DEPART (pas de nouvelle classe cible)", () => {
    expect(needsTargetGroupe("REDOUBLEMENT")).toBe(false);
    expect(needsTargetGroupe("DEPART")).toBe(false);
  });

  it("est faux quand aucune décision n'est sélectionnée", () => {
    expect(needsTargetGroupe("__none__")).toBe(false);
  });
});

describe("needsEnrollmentYear", () => {
  it("est vrai pour PASSAGE et REDOUBLEMENT (une inscription est générée)", () => {
    expect(needsEnrollmentYear("PASSAGE")).toBe(true);
    expect(needsEnrollmentYear("REDOUBLEMENT")).toBe(true);
  });

  it("est faux pour REORIENTATION (élève déjà inscrit, itération 44) et DEPART", () => {
    expect(needsEnrollmentYear("REORIENTATION")).toBe(false);
    expect(needsEnrollmentYear("DEPART")).toBe(false);
  });
});

describe("garde de confirmation EndOfYearPage (needsTargetGroupe || needsEnrollmentYear)", () => {
  const requiresConfirmation = (decision: string) => needsTargetGroupe(decision) || needsEnrollmentYear(decision);

  it("exige une confirmation pour les 3 décisions à effet réel : PASSAGE, REDOUBLEMENT, REORIENTATION", () => {
    expect(requiresConfirmation("PASSAGE")).toBe(true);
    expect(requiresConfirmation("REDOUBLEMENT")).toBe(true);
    expect(requiresConfirmation("REORIENTATION")).toBe(true);
  });

  it("n'exige PAS de confirmation pour DEPART (étiquette informative seulement, aucune action physique)", () => {
    expect(requiresConfirmation("DEPART")).toBe(false);
  });
});
