import { createHash } from "crypto";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { comparePassword, hashPassword } from "../../utils/password";
import {
  refreshTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import type { ChangePasswordInput, RegisterInput } from "./auth.schema";

function publicUser(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isSuperAdmin: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    isSuperAdmin: user.isSuperAdmin,
  };
}

// On ne stocke JAMAIS le refresh token JWT en clair en base : un dump/une
// fuite de la table `RefreshToken` seule ne permet donc plus de rejouer une
// session (défense en profondeur — le JWT lui-même continue d'être renvoyé
// tel quel au client, seul ce qui est PERSISTÉ change). Un hash SHA-256 non
// salé suffit ici : le token source a déjà une entropie cryptographique
// élevée (signature JWT aléatoire par construction), contrairement à un mot
// de passe utilisateur qu'il faudrait saler/bcrypt à cause de son entropie
// potentiellement faible.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Accepte optionnellement un client Prisma (ou un client de transaction
// `tx`) à la place de l'instance globale, pour pouvoir être appelée à
// l'intérieur d'un `prisma.$transaction(...)` (voir `refresh` ci-dessous).
async function issueTokens(
  userId: string,
  isSuperAdmin: boolean,
  client: Pick<typeof prisma, "refreshToken"> = prisma,
) {
  const accessToken = signAccessToken({ sub: userId, isSuperAdmin });
  const refreshToken = signRefreshToken(userId);

  await client.refreshToken.create({
    data: {
      token: hashToken(refreshToken),
      userId,
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing)
    throw ApiError.conflict("Un compte existe déjà avec cet email.");

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
    },
  });

  const tokens = await issueTokens(user.id, user.isSuperAdmin);
  return { user: publicUser(user), ...tokens };
}

async function findUserByIdentifier(identifier: string) {
  const byEmail = await prisma.user.findUnique({
    where: { email: identifier },
  });
  if (byEmail) return byEmail;

  const students = await prisma.student.findMany({
    where: {
      userId: { not: null },
      OR: [
        { nationalIdNumber: identifier },
        { ministryStudentNumber: identifier },
      ],
    },
    select: { userId: true },
  });
  const distinctUserIds = [
    ...new Set(
      students.map((s: { userId: string | null }) => s.userId as string),
    ),
  ];
  if (distinctUserIds.length !== 1) return null;

  return prisma.user.findUnique({ where: { id: distinctUserIds[0] } });
}

export async function login(identifier: string, password: string) {
  const user = await findUserByIdentifier(identifier);
  if (!user || !user.isActive)
    throw ApiError.unauthorized("Identifiants invalides.");

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Identifiants invalides.");

  const tokens = await issueTokens(user.id, user.isSuperAdmin);
  return { user: publicUser(user), ...tokens };
}

export async function refresh(oldToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(oldToken);
  } catch {
    throw ApiError.unauthorized("Refresh token invalide ou expiré.");
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: hashToken(oldToken) },
  });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token invalide ou expiré.");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive)
    throw ApiError.unauthorized("Compte introuvable ou désactivé.");

  // Rotation du refresh token : révocation de l'ancien + émission du neuf
  // dans une seule transaction, pour ne jamais se retrouver avec l'ancien
  // token révoqué mais aucun nouveau émis si le processus s'arrête entre les
  // deux (l'utilisateur serait déconnecté sans recours).
  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });
    return issueTokens(user.id, user.isSuperAdmin, tx);
  });
  return { user: publicUser(user), ...tokens };
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({
    where: { token: hashToken(token) },
    data: { revoked: true },
  });
}

// Changement de mot de passe par l'utilisateur connecté : exige l'ancien mot
// de passe (contrairement à la réinitialisation assistée par un ADMIN, voir
// members.service.ts::resetMemberPassword, qui ne l'exige pas puisque
// l'utilisateur l'a justement oublié). Toutes les autres sessions restent
// valides pour l'instant (pas de révocation en masse des refresh tokens) —
// choix documenté, pas une demande explicite ; à revoir si l'utilisateur
// souhaite un jour "déconnecter tous les appareils" après un changement de
// mot de passe.
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("Utilisateur introuvable.");

  const valid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Mot de passe actuel incorrect.");

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { school: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) throw ApiError.notFound("Utilisateur introuvable.");

  return {
    ...publicUser(user),
    memberships: user.memberships.map(
      (m: { schoolId: string; role: string; school: { name: string } }) => ({
        schoolId: m.schoolId,
        schoolName: m.school.name,
        role: m.role,
      }),
    ),
  };
}
