import { Request } from "express";
import { prisma, SchoolRole } from "../config/prisma";
import { ApiError } from "./ApiError";

export interface TeacherScope {
  staffMemberId: string;
  staffMemberFullName: string;

  groupeIds: Set<string>;

  assignments: Set<string>;
}

function assignmentKey(groupeId: string, subjectId: string): string {
  return `${groupeId}:${subjectId}`;
}

async function fetchTeacherScope(
  userId: string,
  schoolId: string,
): Promise<TeacherScope> {
  const staffMember = await prisma.staffMember.findFirst({
    where: { userId, schoolId },
    select: {
      id: true,
      fullName: true,
      coefficients: { select: { groupeId: true, subjectId: true } },
    },
  });

  if (!staffMember) {
    // Anomalie (rôle ENSEIGNANT sans fiche liée) : scope vide, fail-closed.
    return {
      staffMemberId: "",
      staffMemberFullName: "",
      groupeIds: new Set(),
      assignments: new Set(),
    };
  }

  const groupeIds = new Set<string>();
  const assignments = new Set<string>();
  for (const c of staffMember.coefficients) {
    groupeIds.add(c.groupeId);
    assignments.add(assignmentKey(c.groupeId, c.subjectId));
  }

  return {
    staffMemberId: staffMember.id,
    staffMemberFullName: staffMember.fullName,
    groupeIds,
    assignments,
  };
}

export async function resolveTeacherScope(
  req: Request,
  schoolId: string,
  fullAccessRoles: SchoolRole[],
): Promise<TeacherScope | null> {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.isSuperAdmin) return null;

  const memberships = await prisma.schoolMembership.findMany({
    where: { userId: req.user.id, schoolId },
    select: { role: true },
  });
  const roles = new Set(memberships.map((m) => m.role));

  if (fullAccessRoles.some((r) => roles.has(r))) return null;
  if (!roles.has(SchoolRole.ENSEIGNANT)) return null;

  return fetchTeacherScope(req.user.id, schoolId);
}

export function assertGroupeInScope(
  scope: TeacherScope | null,
  groupeId: string,
): void {
  if (!scope) return;
  if (!scope.groupeIds.has(groupeId)) {
    throw ApiError.forbidden("Vous n'intervenez pas dans cette classe.");
  }
}

export function assertGroupeSubjectInScope(
  scope: TeacherScope | null,
  groupeId: string,
  subjectId: string,
): void {
  if (!scope) return;
  if (!scope.assignments.has(assignmentKey(groupeId, subjectId))) {
    throw ApiError.forbidden(
      "Vous n'enseignez pas cette matière dans cette classe.",
    );
  }
}

export function assertOwnTimetableEntry(
  scope: TeacherScope | null,
  entryTeacherId: string | null,
): void {
  if (!scope) return;
  if (!entryTeacherId || entryTeacherId !== scope.staffMemberId) {
    throw ApiError.forbidden(
      "Vous ne pouvez modifier que vos propres créneaux.",
    );
  }
}

export async function getMyScopeSummary(req: Request, schoolId: string) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.isSuperAdmin) return { restricted: false as const };

  const memberships = await prisma.schoolMembership.findMany({
    where: { userId: req.user.id, schoolId },
    select: { role: true },
  });
  const roles = memberships.map((m) => m.role);

  // Si l'utilisateur détient un rôle de gestion "large" pour au moins l'un
  // des trois domaines concernés (ADMIN couvre tout), pas de filtrage.
  const fullAccessRoles: SchoolRole[] = [
    SchoolRole.ADMIN,
    SchoolRole.GESTION_NOTES,
    SchoolRole.GESTION_ELEVES,
  ];
  if (fullAccessRoles.some((r) => roles.includes(r)))
    return { restricted: false as const };
  if (!roles.includes(SchoolRole.ENSEIGNANT))
    return { restricted: false as const };

  const scope = await fetchTeacherScope(req.user.id, schoolId);
  return {
    restricted: true as const,
    staffMemberId: scope.staffMemberId,
    staffMemberFullName: scope.staffMemberFullName,
    groupeIds: Array.from(scope.groupeIds),
    assignments: Array.from(scope.assignments).map((key) => {
      const [groupeId, subjectId] = key.split(":");
      return { groupeId, subjectId };
    }),
  };
}
