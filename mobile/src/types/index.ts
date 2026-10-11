// Sous-ensemble de frontend/src/types/index.ts (voir la table de réutilisation
// section 2.6 du plan mobile, claude/plan-mobile-react-native.md) — copié
// tel quel plutôt que via un package partagé pour cette Phase 1 (le plan
// documente explicitement que le monorepo/package partagé n'est PAS un
// prérequis bloquant pour démarrer, section 2.7). Ne garder ici QUE ce dont
// les écrans de Phase 1 (login, liste des écoles) ont besoin — étendre au
// fil des phases suivantes plutôt que copier tout le fichier web d'un coup,
// pour ne pas traîner des types jamais utilisés côté mobile.

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

export interface School {
  id: string;
  name: string;
  director?: string | null;
  address?: string | null;
  island?: string | null;
  currency: string;
  createdAt: string;
  myRoles?: SchoolRole[];
  isGuardian?: boolean;
  isStudent?: boolean;
  // Itération 89 — logo d'école (voir schools.service.ts::withHasLogo, même
  // patron que Student.hasPhoto) : jamais le nom de fichier/mime-type bruts,
  // seulement ce booléen — voir mobile/src/api/schools.ts::schoolLogoUrl.
  hasLogo?: boolean;
}

// Forme renvoyée par POST /api/v1/mobile/auth/login|register|refresh (voir
// backend/src/modules/mobile-auth/mobile-auth.controller.ts) — DIFFÉRENTE de
// la forme web (`{ user }` seul, tokens en cookie httpOnly) : ici les tokens
// voyagent dans le corps JSON pour être persistés en SecureStore côté app.
export interface MobileAuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// --- Phase 2a — Tableau de bord + Notes/Bulletins -------------------------
// Ajouté à cette phase, toujours copié depuis frontend/src/types/index.ts
// (voir le commentaire en tête de fichier — même principe qu'en Phase 1).

export interface StudentStats {
  total: number;
  boys: number;
  girls: number;
  averageAge: number | null;
  classCount: number;
}

export interface StaffStats {
  total: number;
  actifs: number;
  totalHeuresSemaine: number;
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

export interface FinanceStats {
  count: number;
  totalRecettes: number;
  totalCharges: number;
  solde: number;
}

export interface AttendanceOverview {
  present: number;
  absent: number;
  retard: number;
  total: number;
  tauxPresence: number | null;
}

export interface TimetableOverview {
  totalEntries: number;
  distinctClasses: number;
  distinctTeachers: number;
}

// GET /schools/:schoolId/dashboard — réservé au personnel (requireAnySchoolRole,
// voir dashboard.routes.ts) : un compte Parent/Élève n'a aucun SchoolRole et
// n'appelle donc JAMAIS cet endpoint (voir School.isGuardian/isStudent,
// utilisés côté écran pour choisir la bonne branche plutôt que d'appeler
// cet endpoint et laisser échouer avec un 403).
export interface DashboardData {
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

// Sous-ensemble de GET /schools/:schoolId/parameters — seuls les champs dont
// les écrans Phase 2a ont besoin (nbTrimestres/trimestreEnCours pour le
// sélecteur de trimestre, classes/groupes pour le sélecteur de classe du
// personnel). Le vrai endpoint renvoie bien plus (feeLevels, cycles,
// series, salles, schoolYears...) — non repris ici, aucun écran mobile n'en
// a besoin pour l'instant.
export interface Classe {
  id: string;
  name: string;
  cycleId: string;
  order: number;
}

export interface Groupe {
  id: string;
  name: string;
  classeId: string;
}

export interface SchoolParametersSummary {
  nbTrimestres: number;
  trimestreEnCours: number;
  classes: Classe[];
  groupes: Groupe[];
}

// Notes/Bulletins — mêmes types que frontend/src/types/index.ts.
export interface GradeEvaluation {
  id: string;
  label: string;
  value: string;
  weight: string;
  order: number;
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

// Itération 83 — saisie de notes. Mêmes types que frontend/src/types/
// index.ts (`SubjectCoefficient`/`Subject`/`Grade`/`TeachingScope`), seuls
// les champs réellement consommés par l'écran de saisie mobile sont repris
// (pas `teacher`/`hoursPerWeek` sur `SubjectCoefficient`, non affichés).
export interface SubjectCoefficient {
  groupeId: string;
  coefficient: string;
}

export interface Subject {
  id: string;
  name: string;
  obligatoire: boolean;
  coefficients: SubjectCoefficient[];
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  trimestre: number;
  evaluations: GradeEvaluation[];
  average: number | null;
}

// GET /schools/:schoolId/me/teaching-scope — filtre les sélecteurs de
// classe/matière pour un compte ENSEIGNANT restreint (voir
// backend/src/utils/teacherScope.ts::getMyScopeSummary), sans dupliquer
// cette logique côté mobile : `restricted: false` = aucun filtrage à
// appliquer (ADMIN, ou un rôle GESTION_* pertinent, ou superadmin).
export type TeachingScope =
  | { restricted: false }
  | {
      restricted: true;
      staffMemberId: string;
      staffMemberFullName: string;
      groupeIds: string[];
      assignments: { groupeId: string; subjectId: string }[];
    };

// Portails Parent/Élève — lecture seule, voir parent-portal.service.ts /
// student-portal.service.ts. `MyStudentSummary` a EXACTEMENT la même forme
// que `ChildSummary` côté backend (même fonction service réutilisée pour
// les deux portails) — un seul type mobile pour les deux, comme côté web.
//
// `groupeLabel` (itération 113, copié depuis frontend/src/types/index.ts —
// voir ce fichier pour le raisonnement complet) : libellé de groupe déjà
// composé côté serveur ("6ème A"), car un compte Parent/Élève n'a pas accès
// à `GET /parameters` pour le recomposer côté client comme le reste de
// l'appli mobile (voir notes.tsx/attendance.tsx/timetable.tsx, qui EUX
// utilisent `params.groupes` de `/parameters`).
export interface GuardianChild {
  id: string;
  matricule: string;
  fullName: string;
  groupeId: string | null;
  groupe: { id: string; name: string } | null;
  groupeLabel: string | null;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "RETARD";

// Corrigé à l'itération 72 : la forme déclarée en Phase 2a (`justified`,
// `comment`) ne correspondait PAS à la vraie réponse API — voir
// attendance.service.ts (`studentSelect`, `AttendanceRecord` Prisma). Champs
// réels : `justifiee`/`motif` (pas `justified`/`comment`), plus `studentId`,
// `subject`, `heure`, et un sous-objet `student` toujours inclus (utile
// pour l'écran Présences du personnel, qui liste plusieurs élèves à la
// fois — Parent/Élève l'ignorent, un seul élève par appel les concernant).
export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  subject?: string | null;
  heure?: string | null;
  motif?: string | null;
  justifiee?: boolean | null;
  student: { id: string; matricule: string; fullName: string; groupeId: string | null };
}

// GET /schools/:schoolId/attendance/stats?groupeId=... — personnel
// uniquement (voir attendance.service.ts::getAttendanceStats). Résumé par
// élève sur l'historique complet de la classe (aucun filtre de date depuis
// mobile — voir attendance.tsx, décision de ne pas introduire de sélecteur
// de plage de dates pour cette phase).
export interface AttendanceStatsRow {
  student: { id: string; matricule: string; fullName: string };
  present: number;
  absent: number;
  retard: number;
  total: number;
  tauxPresence: number | null;
}

export interface AttendanceStats {
  groupe: { id: string; name: string };
  students: AttendanceStatsRow[];
  totals: { present: number; absent: number; retard: number };
}

// GET /schools/:schoolId/timetable (personnel), .../parent/children/:id/
// timetable (parent, itération 72), .../student/me/timetable (élève,
// itération 72) — même forme dans les trois cas (timetable.service.ts::
// listTimetable, réutilisé tel quel par les deux nouveaux endpoints
// portail). `day` reste une chaîne libre côté backend (pas d'enum Prisma),
// voir TIMETABLE_DAYS côté web pour l'ordre d'affichage.
export const TIMETABLE_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

export interface TimetableEntry {
  id: string;
  groupeId: string;
  groupe: { id: string; name: string };
  day: string;
  startTime: string;
  endTime: string;
  subjectName?: string | null;
  teacherName?: string | null;
  teacherId?: string | null;
  salleId?: string | null;
  salle?: { id: string; name: string } | null;
}

export interface Enrollment {
  id: string;
  schoolYearId: string;
  schoolYear: { id: string; label: string };
  feeDue: string;
  amountPaid: string;
  discountAmount: string;
  status: "SOLDE" | "PARTIEL" | "IMPAYE";
}

export interface StudentSummary {
  student: GuardianChild;
  attendance: AttendanceRecord[];
  enrollments: Enrollment[];
  bulletin: Bulletin | null;
}

// --- Phase 2c — Messagerie -------------------------------------------------
// Copié depuis frontend/src/types/index.ts (mêmes noms de champs EXACTEMENT
// — voir le commentaire en tête de ce fichier, même principe qu'aux phases
// précédentes) : REST pour toute écriture, Socket.IO pour la diffusion
// temps réel uniquement (décision d'architecture de l'itération 45,
// inchangée ici). "Tout membre d'une même école" peut écrire à tout autre
// membre (personnel, parent, élève) — `requireSchoolMemberOrGuardian`
// uniquement côté backend, aucune restriction par SchoolRole : les trois
// profils mobiles ont donc un accès identique à ce module.
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

// --- Phase 2d — Élèves / Personnel en consultation -------------------------
// Copié depuis frontend/src/types/index.ts (mêmes noms de champs). Module
// PERSONNEL uniquement : voir personnel.routes.ts (`requireSchoolRole(ADMIN)`
// posé sur TOUT le routeur, lecture comprise — la fiche personnel contient
// `salaireBrut`, aucun rôle `GESTION_PERSONNEL` dédié n'existe). Module
// ÉLÈVES : `requireAnySchoolRole` (tout membre du personnel, portée
// Enseignant appliquée côté serveur via resolveTeacherScope) — voir
// students.routes.ts. Ni l'un ni l'autre n'est exposé à Parent/Élève (aucun
// SchoolRole) : ces deux écrans n'apparaissent que côté StaffDashboard.

// Contrat de pagination PARTAGÉ (`{ data, pagination }`, voir
// backend/src/utils/pagination.ts) — PREMIÈRE utilisation côté mobile de ce
// contrat (Messagerie, Phase 2c, utilise un contrat différent par curseur,
// voir ListMessagesResult ci-dessus). Recommandé explicitement par le plan
// mobile (section 2.3) pour `useInfiniteQuery` : `getNextPageParam: (last) =>
// last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1
// : undefined`.
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

export interface Student {
  id: string;
  matricule: string;
  fullName: string;
  birthDate?: string | null;
  birthPlace?: string | null;
  sex?: "M" | "F" | null;
  parentName?: string | null;
  parentPhone?: string | null;
  nationalIdNumber?: string | null;
  ministryStudentNumber?: string | null;
  groupeId?: string | null;
  groupe?: { id: string; name: string } | null;
  age?: number | null;
  notes?: string | null;
  hasPhoto?: boolean;
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
  hasPhoto?: boolean;
}

// --- Itération 115 — pages publiques (Landing/About/Contact) ---------------
// Copié depuis frontend/src/types/index.ts (même principe que les types
// Messagerie plus haut) : `Testimonial` reflète la forme publique (4 champs
// sélectionnés côté backend, voir publicTestimonials.service.ts) — pas de
// volet ADMIN côté mobile (`AdminTestimonial` côté web), la gestion des
// témoignages reste une tâche d'administration web uniquement.
export interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
}
