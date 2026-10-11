import {
  extractAbsenceNotificationData,
  extractGradeNotificationData,
  extractMessagingNotificationData,
} from "./pushNotifications";

// Phase 4 (itération 82) — l'extraction ne fait jamais confiance à la forme
// de `data` (voir le commentaire du fichier) : elle doit renvoyer `null`
// pour toute forme inattendue plutôt que de naviguer avec des valeurs
// manquantes/erronées.
describe("extractMessagingNotificationData", () => {
  it("extrait schoolId/conversationId quand les deux sont des chaînes", () => {
    expect(extractMessagingNotificationData({ schoolId: "s1", conversationId: "c1" })).toEqual({
      schoolId: "s1",
      conversationId: "c1",
    });
  });

  it("ignore les champs supplémentaires", () => {
    expect(extractMessagingNotificationData({ schoolId: "s1", conversationId: "c1", extra: true })).toEqual({
      schoolId: "s1",
      conversationId: "c1",
    });
  });

  it("renvoie null si un champ manque", () => {
    expect(extractMessagingNotificationData({ schoolId: "s1" })).toBeNull();
    expect(extractMessagingNotificationData({ conversationId: "c1" })).toBeNull();
  });

  it("renvoie null pour une forme de données inattendue", () => {
    expect(extractMessagingNotificationData({ gradeId: "g1" })).toBeNull();
    expect(extractMessagingNotificationData(null)).toBeNull();
    expect(extractMessagingNotificationData(undefined)).toBeNull();
    expect(extractMessagingNotificationData("chaîne")).toBeNull();
    expect(extractMessagingNotificationData({ schoolId: 42, conversationId: "c1" })).toBeNull();
  });

  // Itération 87 — le second déclencheur (absence) partage le champ
  // `schoolId` : sans le discriminant `kind`, une notification d'absence
  // pourrait être mal interprétée si elle portait aussi (par coïncidence)
  // un champ `conversationId`. Vérifie explicitement que `kind: "absence"`
  // fait toujours échouer cette extraction-ci.
  it("renvoie null pour une notification d'absence (kind: absence), même avec les bons champs par ailleurs", () => {
    expect(
      extractMessagingNotificationData({ schoolId: "s1", conversationId: "c1", kind: "absence" })
    ).toBeNull();
  });

  // Itération 110 — même vérification pour le troisième déclencheur (note).
  it("renvoie null pour une notification de note (kind: grade), même avec les bons champs par ailleurs", () => {
    expect(
      extractMessagingNotificationData({ schoolId: "s1", conversationId: "c1", kind: "grade" })
    ).toBeNull();
  });
});

// Itération 87 — pendant du describe ci-dessus pour le second déclencheur
// (voir backend/src/modules/attendance/attendance.service.ts::
// notifyAbsenceGuardians).
describe("extractAbsenceNotificationData", () => {
  it("extrait schoolId/studentId quand kind vaut 'absence'", () => {
    expect(extractAbsenceNotificationData({ schoolId: "s1", studentId: "e1", kind: "absence" })).toEqual({
      schoolId: "s1",
      studentId: "e1",
    });
  });

  it("renvoie null sans le discriminant kind: 'absence'", () => {
    expect(extractAbsenceNotificationData({ schoolId: "s1", studentId: "e1" })).toBeNull();
    expect(extractAbsenceNotificationData({ schoolId: "s1", studentId: "e1", kind: "message" })).toBeNull();
  });

  it("renvoie null si un champ manque ou pour une forme inattendue", () => {
    expect(extractAbsenceNotificationData({ schoolId: "s1", kind: "absence" })).toBeNull();
    expect(extractAbsenceNotificationData({ studentId: "e1", kind: "absence" })).toBeNull();
    expect(extractAbsenceNotificationData(null)).toBeNull();
    expect(extractAbsenceNotificationData("chaîne")).toBeNull();
  });
});

// Itération 110 — pendant du describe ci-dessus pour le troisième déclencheur
// (voir backend/src/modules/grades/grades.service.ts::notifyGradeGuardians).
describe("extractGradeNotificationData", () => {
  it("extrait schoolId/studentId quand kind vaut 'grade'", () => {
    expect(extractGradeNotificationData({ schoolId: "s1", studentId: "e1", kind: "grade" })).toEqual({
      schoolId: "s1",
      studentId: "e1",
    });
  });

  it("renvoie null sans le discriminant kind: 'grade'", () => {
    expect(extractGradeNotificationData({ schoolId: "s1", studentId: "e1" })).toBeNull();
    expect(extractGradeNotificationData({ schoolId: "s1", studentId: "e1", kind: "absence" })).toBeNull();
  });

  it("renvoie null si un champ manque ou pour une forme inattendue", () => {
    expect(extractGradeNotificationData({ schoolId: "s1", kind: "grade" })).toBeNull();
    expect(extractGradeNotificationData({ studentId: "e1", kind: "grade" })).toBeNull();
    expect(extractGradeNotificationData(null)).toBeNull();
    expect(extractGradeNotificationData("chaîne")).toBeNull();
  });
});
