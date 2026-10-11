// Itération 46 — DTOs du "dossier complet" renvoyé par la recherche
// inter-écoles (voir student-network.service.ts). Un `StudentNetworkEntryDTO`
// par école où l'élève réel (identifié par le numéro recherché) possède une
// fiche `Student` — la plupart des élèves n'apparaîtront que dans une seule
// école, un transfert ou une double inscription en produira plusieurs.

export interface StudentNetworkEndOfYearDTO {
  schoolYearLabel: string;
  decision: string;
  originGroupeLabel: string | null;
  targetGroupeLabel: string | null;
  note: string | null;
  createdAt: string;
}

export interface StudentNetworkBulletinDTO {
  trimestre: number;
  average: number | null;
  rank: number | null;
  classSize: number;
  mention: string | null;
}

export interface StudentNetworkAttendanceDTO {
  present: number;
  absent: number;
  retard: number;
  total: number;
  tauxPresence: number | null;
}

export interface StudentNetworkFinanceRowDTO {
  schoolYearLabel: string;
  month: number | null; // présent seulement pour une ligne d'écolage (TuitionFee)
  amountDue: number;
  amountPaid: number;
  discountAmount: number;
  status: string;
}

export interface StudentNetworkEntryDTO {
  studentId: string;
  schoolId: string;
  schoolName: string;
  schoolIsland: string | null;
  fullName: string;
  birthDate: string | null;
  birthPlace: string | null;
  sex: string | null;
  matricule: string;
  nationalIdNumber: string | null;
  ministryStudentNumber: string | null;
  classeLabel: string | null;
  endOfYearDecisions: StudentNetworkEndOfYearDTO[];
  bulletins: StudentNetworkBulletinDTO[];
  attendance: StudentNetworkAttendanceDTO;
  enrollments: StudentNetworkFinanceRowDTO[];
  tuitionFees: StudentNetworkFinanceRowDTO[];
}

export interface StudentNetworkSearchResult {
  field: "nationalIdNumber" | "ministryStudentNumber";
  value: string;
  matches: StudentNetworkEntryDTO[];
}
