import { NextFunction, Request, Response } from "express";
import { prisma, SchoolRole } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";
import { getAccessCookie } from "../utils/cookies";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : undefined;
  const token = getAccessCookie(req) || headerToken;

  if (!token) {
    throw ApiError.unauthorized("Token d'accès manquant.");
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, isSuperAdmin: payload.isSuperAdmin };
    next();
  } catch {
    throw ApiError.unauthorized("Token d'accès invalide ou expiré.");
  }
}

// Réserve la route au superadmin global (accès à toutes les écoles et aux
// fonctionnalités transverses).
export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user?.isSuperAdmin) {
    throw ApiError.forbidden("Réservé au superadmin.");
  }
  next();
}

export function requireSchoolRole(...roles: SchoolRole[]) {
  return async function (req: Request, _res: Response, next: NextFunction) {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.isSuperAdmin) return next();

    const schoolId = req.params.schoolId;
    if (!schoolId || Array.isArray(schoolId)) {
      throw ApiError.badRequest("schoolId manquant dans l'URL.");
    }

    const membership = await prisma.schoolMembership.findFirst({
      where: {
        userId: req.user.id,
        schoolId,
        role: { in: roles },
      },
    });

    if (!membership) {
      throw ApiError.forbidden(
        `Il faut l'un de ces rôles dans cette école : ${roles.join(", ")}.`,
      );
    }

    next();
  };
}

export async function requireAnySchoolRole(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.isSuperAdmin) return next();

  const schoolId = req.params.schoolId;
  if (!schoolId || Array.isArray(schoolId)) {
    throw ApiError.badRequest("schoolId manquant dans l'URL.");
  }

  const membership = await prisma.schoolMembership.findFirst({
    where: { userId: req.user.id, schoolId },
  });

  if (!membership)
    throw ApiError.forbidden("Vous n'êtes pas membre de cette école.");
  next();
}

export async function requireSchoolMemberOrGuardian(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.isSuperAdmin) return next();

  const schoolId = req.params.schoolId;
  if (!schoolId || Array.isArray(schoolId)) {
    throw ApiError.badRequest("schoolId manquant dans l'URL.");
  }

  if (!(await hasSchoolAccess(req.user.id, schoolId))) {
    throw ApiError.forbidden("Vous n'avez pas accès à cette école.");
  }
  next();
}

export async function hasSchoolAccess(
  userId: string,
  schoolId: string,
): Promise<boolean> {
  const membership = await prisma.schoolMembership.findFirst({
    where: { userId, schoolId },
  });
  if (membership) return true;

  const guardianLink = await prisma.studentGuardian.findFirst({
    where: { userId, student: { schoolId } },
  });
  if (guardianLink) return true;

  const studentLink = await prisma.student.findFirst({
    where: { userId, schoolId },
  });
  return Boolean(studentLink);
}
