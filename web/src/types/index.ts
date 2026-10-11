// Types partagés côté frontend — reflètent le schéma Prisma côté backend.

// Correctif audit (pagination serveur) — forme IDENTIQUE sur les 6 endpoints
// de liste concernés (students, attendance, grades, enrollments, finances,
// personnel) : voir backend/src/utils/pagination.ts (source de vérité de ce
// contrat). `Paginated<T>` remplace le tableau brut jusqu'ici renvoyé par
// ces endpoints — tout hook `useXQuery` qui les consomme renvoie désormais
// cette forme plutôt qu'un `T[]` direct.
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

// "ENSEIGNANT" ajouté à l'itération 27 (extension de l'authentification) :
// un compte Enseignant est un SchoolRole classique, lié en plus à une fiche
// Personnel (voir StaffMember côté backend). "PARENT" n'existe volontairement
// PAS ici : un compte Parent n'a aucun SchoolRole (voir School.isGuardian
// ci-dessous et le module parent-portal côté backend).
// "GESTION_RESSOURCES" ajouté à l'itération 48 (partage de ressources au
// public) : cadrage utilisateur explicite ("ADMIN GESTION_RESOURCE ou
// ENSEIGNANT") — un rôle dédié à la publication de ressources, en plus de
// ADMIN et ENSEIGNANT qui y ont également accès.
export type SchoolRole =
  | "ADMIN"
  | "GESTION_ELEVES"
  | "GESTION_NOTES"
  | "GESTION_FINANCES"
  | "ENSEIGNANT"
  | "GESTION_RESSOURCES";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  isSuperAdmin: boolean;
}

// Îles de l'Union des Comores (voir backend/src/utils/comoros.ts).
export const COMOROS_ISLANDS = ["Ngazidja", "Anjouan", "Mohéli"] as const;
export type ComorosIsland = (typeof COMOROS_ISLANDS)[number];

export interface School {
  id: string;
  name: string;
  director?: string | null;
  address?: string | null;
  island?: string | null;
  phone?: string | null;
  email?: string | null;
  arreteNumber?: string | null;
  // Itération 44 — remplace l'ancien `schoolYear?: string | null` texte
  // libre : l'année scolaire "courante" de l'école est désormais une vraie
  // référence vers `SchoolYear` (gérée depuis l'onglet "Années scolaires" de
  // la page Structure pédagogique), jamais un texte libre édité ici.
  currentSchoolYearId?: string | null;
  currentSchoolYear?: SchoolYear | null;
  currency: string;
  cycle?: string | null;
  createdAt: string;
  myRoles?: SchoolRole[];
  // Itération 27 — vrai si l'utilisateur courant accède à cette école
  // uniquement en tant que Parent (StudentGuardian), sans aucun SchoolRole.
  // `myRoles` reste vide/absent dans ce cas : ne pas en déduire l'inverse.
  isGuardian?: boolean;
  // Itération 31 — idem, vrai si l'utilisateur courant EST l'élève lié
  // (Student.userId) de cette école. Un utilisateur peut en théorie être à
  // la fois isGuardian ET isStudent (cas non traité spécifiquement dans
  // l'UI, resté un cas limite non demandé).
  isStudent?: boolean;
  _count?: { students: number; memberships: number };
  // Itération 64 — logo d'école. Booléen calculé côté serveur (jamais le nom
  // de fichier brut, voir schools.service.ts::withHasLogo) : sert à savoir
  // s'il faut afficher `<img src={schoolLogoUrl(...)}>` (voir
  // features/schools/api.ts).
  hasLogo?: boolean;
}

// Élève tel que renvoyé par le module parent-portal (résumé minimal, pas le
// même shape que Student complet des modules Élèves/Notes/Présences).
//
// `groupeLabel` (itération 113) : libellé composé côté serveur ("6ème A",
// classe + série éventuelle + groupe — voir lib/groupeLabel.ts pour
// l'équivalent utilisé partout ailleurs dans l'appli), `null` si l'élève
// n'a pas de groupe. Un compte Parent/Élève n'a pas accès à
// `GET /parameters` (403, aucun SchoolMembership) et ne peut donc pas
// recomposer ce libellé côté client comme le reste de l'appli — d'où ce
// champ déjà prêt, pour ne plus afficher le seul `groupe.name` brut et
// ambigu (ex "A" au lieu de "6ème A"). `groupe` reste inchangé pour la
// rétrocompatibilité de forme.
export interface GuardianChild {
  id: string;
  matricule: string;
  fullName: string;
  groupeId: string | null;
  groupe: { id: string; name: string } | null;
  groupeLabel: string | null;
}

// Résumé renvoyé par GET /schools/:schoolId/parent/children/:studentId/summary
// (module parent-portal, itération 27). `bulletin` est `null` tant qu'aucune
// note n'existe pour le trimestre demandé — cas normal en début d'année, pas
// une erreur.
export interface ChildSummary {
  student: GuardianChild;
  attendance: AttendanceRecord[];
  enrollments: Enrollment[];
  bulletin: Bulletin | null;
}

// Résumé renvoyé par GET /schools/:schoolId/student/me/summary (module
// student-portal, itération 31) — même shape que ChildSummary (portail
// Parent), réutilisé tel quel : le "student" ici est toujours l'élève lié
// au compte connecté, jamais choisi.
export type MyStudentSummary = ChildSummary;

// Itération 35 — structure pédagogique : Cycle (Primaire/Collège/Lycée) ->
// Classe (niveau, ex "6ème") -> Série (optionnelle, ex "L"/"G"/"S") ->
// Groupe (section concrète, ex "A"/"B" — l'ancien `ClassRoom`), + Salle
// (local physique, indépendant de cette hiérarchie). Voir
// backend/prisma/schema.prisma pour le détail de chaque entité.
export interface Cycle {
  id: string;
  name: string;
  order: number;
}

export interface Classe {
  id: string;
  cycleId: string;
  name: string;
  order: number;
}

export interface Serie {
  id: string;
  classeId: string;
  name: string;
  order: number;
}

export interface Groupe {
  id: string;
  name: string;
  classeId: string;
  serieId?: string | null;
  targetSize?: number | null;
}

export interface Salle {
  id: string;
  name: string;
  capacity?: number | null;
  type?: string | null;
}

// Itération 44 — demande utilisateur : "les années scolaires doivent être
// sélectionnées sur combo et non écrits sur input, avec une interface de
// gestion des années scolaires où on peut ajouter ou modifier". Même patron
// que Cycle/Classe/Série/Groupe/Salle ci-dessus (entité de référence gérée
// depuis l'onglet "Années scolaires" de la page Structure pédagogique) —
// mais avec une vraie clé étrangère partout ailleurs dans l'app (choix de
// cadrage explicite `AskUserQuestion`, option NON recommandée retenue face à
// une simple liste de libellés).
export interface SchoolYear {
  id: string;
  label: string;
  order: number;
}

// Types de salle suggérés (texte libre côté backend, une simple <datalist>
// ici — voir le commentaire de `Salle.type` dans schema.prisma).
export const SALLE_TYPES = ["Standard", "Laboratoire", "Informatique", "Sport", "Autre"] as const;

export interface SchoolParameters {
  noteMax: string;
  notePassage: string;
  nbTrimestres: number;
  trimestreEnCours: number;
  nbHeuresSemaine: number;
  seuilBien: string;
  seuilTresBien: string;
  seuilExcellent: string;
  // `monthlyAmount` — itération 34, tarif mensuel d'écolage suggéré pour ce
  // niveau (voir `FeeLevel.monthlyAmount` côté backend) ; `null`/absent tant
  // qu'aucun tarif n'a encore été configuré pour ce niveau.
  // Itération 35 — `classeId` remplace l'ancien `levelName` texte libre
  // (vraie FK vers `Classe` désormais, voir schema.prisma::FeeLevel).
  feeLevels: { id: string; classeId: string; amount: string; monthlyAmount?: string | null; order: number }[];
  cycles: Cycle[];
  classes: Classe[];
  series: Serie[];
  groupes: Groupe[];
  salles: Salle[];
  // Itération 44 — voir `SchoolYear` ci-dessus.
  schoolYears: SchoolYear[];
  currentSchoolYearId: string | null;
}

export interface Member {
  user: { id: string; email: string; fullName: string; phone?: string | null };
  roles: SchoolRole[];
}

export interface Student {
  id: string;
  matricule: string;
  fullName: string;
  birthDate?: string | null;
  birthPlace?: string | null;
  sex?: "M" | "F" | null;
  parentName?: string | null;
  parentPhone?: string | null;
  // Itération 46 — identifiants externes optionnels (voir le commentaire sur
  // Student.nationalIdNumber/ministryStudentNumber côté backend) : servent à
  // retrouver le parcours de cet élève dans d'autres écoles (voir
  // features/student-network/). Uniques PAR ÉCOLE, pas globalement.
  nationalIdNumber?: string | null;
  ministryStudentNumber?: string | null;
  groupeId?: string | null;
  groupe?: { id: string; name: string } | null;
  age?: number | null;
  notes?: string | null;
  // Itération 31 — présent (non `null`) si cet élève a déjà un compte de
  // connexion lié (voir Student.userId côté backend). Sert uniquement à
  // filtrer la liste des candidats dans le formulaire "Créer un compte
  // Élève" (SchoolMembersPage.tsx) — jamais affiché tel quel ailleurs.
  userId?: string | null;
  // Itération 64 — photo d'identité. Booléen calculé côté serveur (jamais le
  // nom de fichier brut, voir students.service.ts::withHasPhoto) : sert à
  // savoir s'il faut afficher `<img src={studentPhotoUrl(...)}>` (voir
  // features/students/api.ts).
  hasPhoto?: boolean;
}

// Itération 46 — recherche inter-écoles (module student-network). Un
// élément par école où l'élève réel (identifié par le numéro recherché)
// possède une fiche `Student` — voir le commentaire d'en-tête de
// student-network.service.ts côté backend pour le cadrage complet.
export interface StudentNetworkEndOfYearEntry {
  schoolYearLabel: string;
  decision: string;
  originGroupeLabel: string | null;
  targetGroupeLabel: string | null;
  note?: string | null;
  createdAt: string;
}

export interface StudentNetworkBulletin {
  trimestre: number;
  average: number | null;
  rank: number | null;
  classSize: number;
  mention: string | null;
}

export interface StudentNetworkAttendance {
  present: number;
  absent: number;
  retard: number;
  total: number;
  tauxPresence: number | null;
}

export interface StudentNetworkFinanceRow {
  schoolYearLabel: string;
  month: number | null;
  amountDue: number;
  amountPaid: number;
  discountAmount: number;
  status: string;
}

export interface StudentNetworkEntry {
  studentId: string;
  schoolId: string;
  schoolName: string;
  schoolIsland?: string | null;
  fullName: string;
  birthDate: string | null;
  birthPlace?: string | null;
  sex?: string | null;
  matricule: string;
  nationalIdNumber?: string | null;
  ministryStudentNumber?: string | null;
  classeLabel: string | null;
  endOfYearDecisions: StudentNetworkEndOfYearEntry[];
  bulletins: StudentNetworkBulletin[];
  attendance: StudentNetworkAttendance;
  enrollments: StudentNetworkFinanceRow[];
  tuitionFees: StudentNetworkFinanceRow[];
}

export interface StudentNetworkSearchResult {
  field: "nationalIdNumber" | "ministryStudentNumber";
  value: string;
  matches: StudentNetworkEntry[];
}

export interface StudentStats {
  total: number;
  boys: number;
  girls: number;
  averageAge: number | null;
  classCount: number;
}

export interface SubjectCoefficient {
  id: string;
  groupeId: string;
  groupe: { id: string; name: string };
  coefficient: string;
  hoursPerWeek?: number | null;
  teacherId?: string | null;
  teacher?: { id: string; fullName: string } | null;
}

export interface Subject {
  id: string;
  name: string;
  obligatoire: boolean;
  coefficients: SubjectCoefficient[];
}

export type FeeStatus = "SOLDE" | "PARTIEL" | "IMPAYE";

export interface Enrollment {
  id: string;
  studentId: string;
  student: {
    id: string;
    matricule: string;
    fullName: string;
    groupeId?: string | null;
    groupe?: { id: string; name: string } | null;
  };
  // Itération 44 — `schoolYear` (texte libre) remplacé par une FK réelle.
  schoolYearId: string;
  schoolYear: SchoolYear;
  feeDue: string;
  amountPaid: string;
  // Réduction négociée (fratrie, bourse, difficulté financière...),
  // purement déclarative — voir le commentaire sur `Enrollment.
  // discountAmount` dans backend/prisma/schema.prisma.
  discountAmount: string;
  discountReason?: string | null;
  paymentMode?: string | null;
  paymentDate?: string | null;
  status: FeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentStats {
  count: number;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  totalDiscounts: number;
  solde: number;
  partiel: number;
  impaye: number;
}

// Itération 43 — décisions de fin d'année (passage/redoublement/départ/
// réorientation), voir backend/prisma/schema.prisma::EndOfYearDecision.
export type EndOfYearDecisionType = "PASSAGE" | "REDOUBLEMENT" | "DEPART" | "REORIENTATION";

export interface EndOfYearDecision {
  id: string;
  decision: EndOfYearDecisionType;
  targetGroupeId: string | null;
  targetGroupeName: string | null;
  // Itération 44 — inscription automatique sur Passage/Redoublement : année
  // scolaire de la nouvelle inscription (choisie/confirmée par le
  // personnel, jamais déduite silencieusement) et id de l'inscription
  // réellement générée, le cas échéant (voir schema.prisma::
  // EndOfYearDecision pour le détail complet du cadrage).
  enrollmentSchoolYearId: string | null;
  enrollmentSchoolYearLabel: string | null;
  generatedEnrollmentId: string | null;
  note: string | null;
  decidedAt: string;
}

// Une ligne par élève d'un groupe : la vue de travail "conseil de classe"
// (GET .../end-of-year/overview) — moyenne annuelle + suggestion, jamais
// appliquée automatiquement (voir end-of-year.service.ts::suggestDecision,
// côté backend).
export interface EndOfYearOverviewRow {
  student: { id: string; matricule: string; fullName: string };
  annualAverage: number | null;
  suggestedDecision: EndOfYearDecisionType | null;
  decision: EndOfYearDecision | null;
}

export interface EndOfYearStats {
  totalStudents: number;
  decided: number;
  pending: number;
  passage: number;
  redoublement: number;
  depart: number;
  reorientation: number;
}

// Itération 34 — écolage mensuel, distinct du droit d'inscription annuel
// ci-dessus (voir backend/prisma/schema.prisma::TuitionFee). Même forme
// que `Enrollment`, avec `month` (1-12) en plus.
export interface TuitionFee {
  id: string;
  studentId: string;
  student: {
    id: string;
    matricule: string;
    fullName: string;
    groupeId?: string | null;
    groupe?: { id: string; name: string } | null;
  };
  // Itération 44 — `schoolYear` (texte libre) remplacé par une FK réelle.
  schoolYearId: string;
  schoolYear: SchoolYear;
  month: number;
  amountDue: string;
  amountPaid: string;
  discountAmount: string;
  discountReason?: string | null;
  paymentMode?: string | null;
  paymentDate?: string | null;
  status: FeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TuitionFeeStats {
  count: number;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  totalDiscounts: number;
  solde: number;
  partiel: number;
  impaye: number;
}

// Réponse de POST /schools/:schoolId/tuition-fees/generate.
export interface GenerateTuitionFeesResult {
  created: number;
  skipped: number;
  unconfiguredLevels: string[];
}

// Rapport "Suivi des paiements" (GET /schools/:schoolId/payment-tracking) —
// une ligne par élève, croisant droit d'inscription et écolage pour l'année
// scolaire demandée. `enrollment: null` = aucune inscription enregistrée
// pour cette année (pas encore suivi, différent d'un impayé) ;
// `tuition.monthsTracked === 0` = même chose côté écolage (aucun mois
// généré pour l'instant).
export interface PaymentTrackingRow {
  student: {
    id: string;
    matricule: string;
    fullName: string;
    groupeId?: string | null;
    groupe?: { id: string; name: string } | null;
  };
  enrollment: { status: FeeStatus; feeDue: number; amountPaid: number } | null;
  tuition: {
    monthsTracked: number;
    monthsUnpaid: number[];
    totalDue: number;
    totalPaid: number;
    upToDate: boolean;
  };
}

export interface PaymentTrackingStats {
  totalStudents: number;
  enrollmentUpToDate: number;
  enrollmentBehind: number;
  enrollmentNotTracked: number;
  tuitionUpToDate: number;
  tuitionBehind: number;
}

// Une évaluation pondérée (ex. "Devoir 1" à 25 %, "Composition" à 75 %) —
// remplace les anciens champs fixes note1/note2/note3. Le poids est RELATIF
// (voir backend/prisma/schema.prisma::GradeEvaluation) : la moyenne se
// normalise par la somme des poids réellement saisis.
export interface GradeEvaluation {
  id: string;
  label: string;
  value: string;
  weight: string;
  order: number;
}

export interface Grade {
  id: string;
  studentId: string;
  student: { id: string; matricule: string; fullName: string; groupeId?: string | null };
  subjectId: string;
  subject: { id: string; name: string };
  trimestre: number;
  evaluations: GradeEvaluation[];
  average: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulletinSubjectRow {
  subjectId: string;
  subjectName: string;
  coefficient: string;
  evaluations: GradeEvaluation[];
  average: number | null;
}

export interface Bulletin {
  student: { id: string; matricule: string; fullName: string };
  trimestre: number;
  subjects: BulletinSubjectRow[];
  average: number | null;
  rank: number | null;
  classSize: number;
  mention: string | null;
  noteMax: string;
  notePassage: string;
}

export interface RankingRow {
  student: { id: string; matricule: string; fullName: string };
  average: number | null;
  rank: number | null;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "RETARD";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  student: { id: string; matricule: string; fullName: string; groupeId?: string | null };
  date: string;
  status: AttendanceStatus;
  subject?: string | null;
  heure?: string | null;
  motif?: string | null;
  justifiee?: boolean | null;
}

export interface AttendanceStatRow {
  student: { id: string; matricule: string; fullName: string };
  present: number;
  absent: number;
  retard: number;
  total: number;
  tauxPresence: number | null;
}

export interface AttendanceStats {
  groupe: { id: string; name: string };
  students: AttendanceStatRow[];
  totals: { present: number; absent: number; retard: number; total: number; tauxPresence: number | null };
}

export interface StaffMember {
  id: string;
  schoolId: string;
  fullName: string;
  specialite?: string | null;
  fonction?: string | null;
  diplome?: string | null;
  typeContrat?: string | null;
  salaireBrut?: string | null;
  heuresSemaine?: number | null;
  statut: string;
  // Itération 27 — présent (Prisma renvoie tous les champs scalaires par
  // défaut) dès qu'un compte Enseignant a été créé et lié à cette fiche ;
  // sert côté SchoolMembersPage à exclure du sélecteur les fiches déjà liées.
  userId?: string | null;
  // Itération 64 — photo d'identité, même patron que Student.hasPhoto
  // ci-dessus (voir son commentaire).
  hasPhoto?: boolean;
}

export interface StaffStats {
  total: number;
  actifs: number;
  totalHeuresSemaine: number;
}

export const TIMETABLE_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;
export type TimetableDay = (typeof TIMETABLE_DAYS)[number];

export interface TimetableEntry {
  id: string;
  groupeId: string;
  groupe: { id: string; name: string };
  day: TimetableDay;
  startTime: string;
  endTime: string;
  subjectName?: string | null;
  teacherName?: string | null;
  // Itération 29 — lien vers la fiche StaffMember auteure du créneau (voir
  // TimetableEntry.teacherId côté schéma Prisma) ; `null` pour un créneau
  // pas encore rattaché (créé avant cette itération, ou intervenant non
  // inscrit au registre du personnel).
  teacherId?: string | null;
  // Itération 35 — demande utilisateur : "un créneau avec ... salle".
  salleId?: string | null;
  salle?: { id: string; name: string } | null;
}

export type FinanceEntryType = "RECETTE" | "CHARGE";

export interface FinanceEntry {
  id: string;
  type: FinanceEntryType;
  label: string;
  month: number;
  year: number;
  amount: string;
}

export interface FinanceStats {
  count: number;
  totalRecettes: number;
  totalCharges: number;
  solde: number;
}

export interface FinanceMonthlyPoint {
  month: number;
  totalRecettes: number;
  totalCharges: number;
  solde: number;
}

export interface TimetableOverview {
  totalEntries: number;
  distinctClasses: number;
  distinctTeachers: number;
}

export interface AttendanceOverview {
  present: number;
  absent: number;
  retard: number;
  total: number;
  tauxPresence: number | null;
}

export interface DashboardData {
  // Itération 44 — `schoolYear` (texte libre) remplacé par `schoolYearId` +
  // `schoolYearLabel` (voir dashboard.service.ts::getDashboard).
  schoolYearId: string | null;
  schoolYearLabel: string | null;
  students: StudentStats;
  staff: StaffStats;
  classCount: number;
  enrollments: EnrollmentStats;
  finance: FinanceStats & { year: number };
  attendance: AttendanceOverview;
  timetable: TimetableOverview;
}

// Itération 35 — réponse de GET /schools/:schoolId/analytics : tableau de
// bord d'analyse dédié "par cycle, groupe, série, salle" (demande
// utilisateur), distinct du tableau de bord général (`DashboardData`
// ci-dessus). Voir backend/src/modules/analytics/analytics.service.ts pour
// le détail du calcul de chaque agrégat.
export interface AnalyticsEffectifRow {
  id: string;
  name: string;
  count: number;
}

export interface AnalyticsPresenceRow {
  id: string;
  name: string;
  tauxPresence: number | null;
  total: number;
}

export interface AnalyticsMoyenneRow {
  id: string;
  name: string;
  moyenne: number | null;
}

export interface AnalyticsSalleRow {
  id: string;
  name: string;
  type?: string | null;
  capacity?: number | null;
  hoursPerWeek: number;
  entryCount: number;
}

export interface AnalyticsOverview {
  trimestre: number;
  structure: {
    cycles: { id: string; name: string }[];
    classes: { id: string; name: string; cycleId: string }[];
    series: { id: string; name: string; classeId: string }[];
    groupes: { id: string; name: string; classeId: string; serieId: string | null }[];
    salles: { id: string; name: string; type?: string | null; capacity?: number | null }[];
  };
  effectifs: {
    sansGroupe: number;
    byCycle: AnalyticsEffectifRow[];
    byClasse: (AnalyticsEffectifRow & { cycleId: string })[];
    bySerie: (AnalyticsEffectifRow & { classeId: string })[];
    byGroupe: (AnalyticsEffectifRow & { classeId: string; serieId: string | null })[];
  };
  presence: {
    byCycle: AnalyticsPresenceRow[];
    byGroupe: AnalyticsPresenceRow[];
  };
  moyennes: {
    byClasse: AnalyticsMoyenneRow[];
    bySerie: AnalyticsMoyenneRow[];
    byGroupe: AnalyticsMoyenneRow[];
  };
  salles: AnalyticsSalleRow[];
}

// Itération 67 — demande utilisateur : "le superadmin doit avoir les
// statistiques globales des écoles par années académiques, par cycles, par
// séries, par classes". Distinct de `AnalyticsOverview` ci-dessus (une
// seule école, agrégée par id) : ici chaque ligne cycle/classe/série vient
// d'une école DIFFÉRENTE (pas de table de référence partagée entre
// écoles) — le regroupement se fait par LIBELLÉ (`name`), pas par id, donc
// pas de `structure`/ids à filtrer ici, juste des lignes déjà agrégées.
// Voir backend/src/modules/admin-stats/admin-stats.service.ts pour le
// détail (et les limites assumées : présence/moyennes toutes années
// confondues, seuls les effectifs sont ventilés par année académique).
export interface GlobalStatsNamedRow {
  name: string;
  count: number;
}
export interface GlobalStatsYearRow {
  label: string;
  count: number;
}
export interface GlobalStatsPresenceRow {
  name: string;
  tauxPresence: number | null;
  total: number;
}
export interface GlobalStatsMoyenneRow {
  name: string;
  moyenne: number | null;
}
export interface GlobalStatsEcoleRow {
  id: string;
  name: string;
  island?: string | null;
  effectifs: number;
  tauxPresence: number | null;
  moyenneGenerale: number | null;
}

export interface GlobalStatsOverview {
  schoolsCount: number;
  effectifs: {
    total: number;
    sansPlacement: number;
    byYear: GlobalStatsYearRow[];
    byCycle: GlobalStatsNamedRow[];
    byClasse: GlobalStatsNamedRow[];
    bySerie: GlobalStatsNamedRow[];
  };
  presence: {
    byCycle: GlobalStatsPresenceRow[];
    byClasse: GlobalStatsPresenceRow[];
    bySerie: GlobalStatsPresenceRow[];
  };
  moyennes: {
    byCycle: GlobalStatsMoyenneRow[];
    byClasse: GlobalStatsMoyenneRow[];
    bySerie: GlobalStatsMoyenneRow[];
  };
  byEcole: GlobalStatsEcoleRow[];
}

// Itération 29 — "filtrage fin Enseignant" : résumé du scope de
// l'utilisateur courant renvoyé par GET /schools/:schoolId/me/teaching-scope
// (voir backend/src/utils/teacherScope.ts::getMyScopeSummary).
// `restricted: false` = accès complet, aucun filtrage à appliquer côté UI.
export type TeachingScope =
  | { restricted: false }
  | {
      restricted: true;
      staffMemberId: string;
      staffMemberFullName: string;
      groupeIds: string[];
      assignments: { groupeId: string; subjectId: string }[];
    };

// ----------------------------------------------------------------------------
// Itération 45 — messagerie instantanée. Reflète EXACTEMENT les DTO renvoyés
// par le module `messaging` côté backend (voir backend/src/modules/
// messaging/messaging.types.ts) : un seul endroit décrit la forme d'un
// message/d'une conversation, jamais retapée différemment ici.
// ----------------------------------------------------------------------------

// Cadrage `AskUserQuestion` — "tout membre d'une même école" : un contact
// peut être un membre du personnel, un parent, ou un élève (les trois seuls
// "types de compte" que ce projet connaît, voir School.isGuardian/isStudent
// plus haut).
export interface MessagingContact {
  id: string;
  fullName: string;
  kind: "STAFF" | "PARENT" | "STUDENT";
}

export interface MessageAttachmentMeta {
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
}

export interface Message extends MessageAttachmentMeta {
  id: string;
  conversationId: string;
  seq: number;
  senderId: string;
  sender: { id: string; fullName: string };
  content: string | null;
  hasAttachment: boolean;
  createdAt: string;
}

export type ConversationType = "PRIVATE" | "GROUP";
export type ParticipantRole = "MEMBER" | "ADMIN";

export interface ConversationParticipant {
  userId: string;
  fullName: string;
  role: ParticipantRole;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  // Nom d'affichage déjà résolu côté serveur (nom du groupe, ou de l'autre
  // participant pour une conversation privée) — voir le commentaire sur
  // `ConversationSummaryDTO.displayName` côté backend.
  displayName: string;
  participants: ConversationParticipant[];
  myRole: ParticipantRole;
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ListMessagesResult {
  data: Message[];
  nextCursor: number | null;
}

export interface PresenceInfo {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
}

// ----------------------------------------------------------------------------
// Itération 48 — partage de ressources au public. Reflète EXACTEMENT les DTO
// renvoyés par les deux volets backend : `modules/resources` (gestion,
// authentifié) et `modules/public-resources` (public, sans authentification)
// — voir le commentaire d'en-tête du modèle `Resource` dans schema.prisma
// pour le cadrage complet (rôles autorisés, associations, filtres).
// ----------------------------------------------------------------------------

export type ResourceType = "DOCUMENT" | "VIDEO";

export interface ResourceSubjectLink {
  subject: { id: string; name: string };
}

export interface ResourceClasseLink {
  classe: { id: string; name: string; cycle?: { id: string; name: string } };
}

// Forme renvoyée par le volet GESTION (une seule école, déjà connue de
// l'URL — pas de `school` imbriqué).
export interface Resource {
  id: string;
  schoolId: string;
  title: string;
  description?: string | null;
  type: ResourceType;
  fileName?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  videoUrl?: string | null;
  published: boolean;
  publishedBy: { id: string; fullName: string };
  subjects: ResourceSubjectLink[];
  classes: ResourceClasseLink[];
  createdAt: string;
  updatedAt: string;
}

// Forme renvoyée par le volet PUBLIC : mêmes champs de base, MOINS
// `schoolId`/`publishedBy` (jamais exposés au public — voir
// publicResources.service.ts), PLUS `school` imbriquée (la page publique
// couvre toutes les écoles à la fois, contrairement au volet gestion).
export interface PublicResource {
  id: string;
  title: string;
  description?: string | null;
  type: ResourceType;
  originalName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  videoUrl?: string | null;
  school: { id: string; name: string; island?: string | null };
  subjects: ResourceSubjectLink[];
  classes: ResourceClasseLink[];
  createdAt: string;
}

// Options des sélecteurs de filtre de la page publique — GET
// /public/resources/filters (voir publicResources.service.ts::
// listPublicFilterOptions).
export interface PublicResourceFilterOptions {
  schools: { id: string; name: string; island?: string | null }[];
  cycles: { id: string; name: string; schoolId: string }[];
  classes: { id: string; name: string; cycleId: string; schoolId: string }[];
  series: { id: string; name: string; classeId: string; schoolId: string }[];
  subjects: { id: string; name: string; schoolId: string }[];
}

// Itération 50 — "permettre les select multiple" : chaque dimension devient
// un tableau (plusieurs valeurs cumulables au sein d'une même dimension) —
// voir features/public-resources/api.ts pour la sérialisation CSV envoyée
// au backend.
export interface PublicResourcesFilters {
  schoolIds?: string[];
  classeIds?: string[];
  serieIds?: string[];
  cycleIds?: string[];
  subjectIds?: string[];
  types?: ResourceType[];
}

// Itération 62 — landing page "témoignages dynamiques" — GET
// /public/testimonials (voir publicTestimonials.service.ts).
export interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
}

// Itération 63 — vue ADMIN d'un témoignage (GET/POST/DELETE
// /admin/testimonials) : la ligne complète, publiée ou non, contrairement à
// `Testimonial` ci-dessus qui ne reflète que la forme publique (4 champs
// sélectionnés côté backend, voir publicTestimonials.service.ts).
export interface AdminTestimonial {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Itération 63 — vue ADMIN d'un message de contact (GET
// /admin/contact-messages), lecture seule — voir contact.schema.ts côté
// backend pour les mêmes champs côté envoi public.
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}
