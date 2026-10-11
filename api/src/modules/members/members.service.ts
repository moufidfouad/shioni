import { prisma, SchoolRole } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { generateTemporaryPassword, hashPassword } from "../../utils/password";
import { getStaffMember } from "../personnel/personnel.service";
import { getStudent } from "../students/students.service";

export async function listMembers(schoolId: string) {
  const memberships = await prisma.schoolMembership.findMany({
    where: { schoolId },
    include: { user: { select: { id: true, email: true, fullName: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  // On regroupe par utilisateur : { user, roles: [...] } plutôt qu'une
  // ligne par (utilisateur, rôle), plus pratique côté UI.
  const byUser = new Map<string, { user: (typeof memberships)[number]["user"]; roles: SchoolRole[] }>();
  for (const m of memberships) {
    const entry = byUser.get(m.user.id) ?? { user: m.user, roles: [] };
    entry.roles.push(m.role);
    byUser.set(m.user.id, entry);
  }
  return Array.from(byUser.values());
}

// Ajoute un ou plusieurs rôles à un utilisateur existant (identifié par
// email) pour une école donnée. L'utilisateur doit déjà avoir un compte —
// on ne crée pas de compte "fantôme" ici, il doit s'être inscrit lui-même.
export async function addMember(schoolId: string, email: string, roles: SchoolRole[]) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw ApiError.notFound(
      "Aucun compte n'existe avec cet email. La personne doit d'abord créer un compte."
    );
  }

  await prisma.$transaction(
    roles.map((role) =>
      prisma.schoolMembership.upsert({
        where: { userId_schoolId_role: { userId: user.id, schoolId, role } },
        update: {},
        create: { userId: user.id, schoolId, role },
      })
    )
  );

  return { userId: user.id, email: user.email, fullName: user.fullName, roles };
}

// Remplace entièrement la liste des rôles d'un utilisateur dans une école.
export async function setMemberRoles(schoolId: string, userId: string, roles: SchoolRole[]) {
  if (roles.length === 0) {
    // Aucun rôle -> on retire complètement l'utilisateur de l'école.
    await prisma.schoolMembership.deleteMany({ where: { schoolId, userId } });
    return { userId, roles: [] };
  }

  await prisma.$transaction([
    prisma.schoolMembership.deleteMany({ where: { schoolId, userId, role: { notIn: roles } } }),
    ...roles.map((role) =>
      prisma.schoolMembership.upsert({
        where: { userId_schoolId_role: { userId, schoolId, role } },
        update: {},
        create: { userId, schoolId, role },
      })
    ),
  ]);

  return { userId, roles };
}

export async function removeMember(schoolId: string, userId: string) {
  const { count } = await prisma.schoolMembership.deleteMany({ where: { schoolId, userId } });
  if (count === 0) throw ApiError.notFound("Cet utilisateur n'est pas membre de cette école.");
}

// Réinitialisation de mot de passe ASSISTÉE : demande explicite de
// l'utilisateur ("un utilisateur doit pouvoir ... récupérer son mot de
// passe en cas d'oubli"), choisie ici plutôt qu'un lien envoyé par email —
// aucun service d'envoi d'email n'existe dans ce projet, et sur le terrain
// aux Comores l'accès email n'est pas garanti pour tout le personnel d'une
// école. Un ADMIN de l'école (ou le superadmin, via `requireSchoolRole` déjà
// posé sur ce routeur) génère un mot de passe temporaire et le communique
// lui-même à la personne concernée (de vive voix, par SMS...). Contrairement
// à `auth.service.ts::changePassword`, aucune preuve de l'ancien mot de
// passe n'est demandée ici — c'est justement le but : l'utilisateur l'a
// oublié. Le mot de passe temporaire n'est JAMAIS stocké en clair ni
// journalisé : il n'existe que dans la valeur de retour de cette fonction,
// renvoyée une seule fois par l'API.
export async function resetMemberPassword(schoolId: string, userId: string) {
  const membership = await prisma.schoolMembership.findFirst({ where: { schoolId, userId } });
  if (!membership) throw ApiError.notFound("Cet utilisateur n'est pas membre de cette école.");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: { id: true, email: true, fullName: true },
  });

  return { ...user, temporaryPassword };
}

// ----------------------------------------------------------------------------
// Itération 27 — création ASSISTÉE de comptes Enseignant/Parent.
//
// Contrairement à `addMember` ci-dessus (qui suppose un compte déjà créé par
// la personne elle-même), ces deux fonctions CRÉENT le compte — même choix
// "pas de flux email en libre-service" qu'à l'itération 20
// (`resetMemberPassword`) : un mot de passe temporaire est généré et renvoyé
// UNE SEULE fois dans la réponse HTTP, jamais stocké en clair ni journalisé,
// à communiquer par l'ADMIN de vive voix/par SMS.
// ----------------------------------------------------------------------------

async function createLinkedUser(email: string, fullName: string, phone: string | undefined) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict(
      "Un compte existe déjà avec cet email. Utilisez plutôt \"Ajouter un membre existant\" pour lui donner un rôle dans cette école."
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await prisma.user.create({
    data: { email, fullName, phone: phone || null, passwordHash },
  });
  return { user, temporaryPassword };
}

// Compte Enseignant : lié à une fiche Personnel (StaffMember) déjà
// existante dans cette école — décision explicite de l'utilisateur plutôt
// qu'un profil enseignant indépendant, pour ne jamais dupliquer une
// information déjà saisie (matière, classes, coefficients...). Un
// STAFFMember ne peut être lié qu'à un seul compte à la fois (contrainte
// `@unique` sur `StaffMember.userId`).
export async function createTeacherAccount(
  schoolId: string,
  input: { email: string; fullName: string; phone?: string; staffMemberId: string }
) {
  const staff = await getStaffMember(schoolId, input.staffMemberId); // 404 si absent/hors école
  if (staff.userId) {
    throw ApiError.conflict("Cette fiche Personnel est déjà liée à un compte de connexion.");
  }

  const { user, temporaryPassword } = await createLinkedUser(input.email, input.fullName, input.phone);

  await prisma.$transaction([
    prisma.staffMember.update({ where: { id: staff.id }, data: { userId: user.id } }),
    prisma.schoolMembership.create({ data: { userId: user.id, schoolId, role: SchoolRole.ENSEIGNANT } }),
  ]);

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    staffMemberId: staff.id,
    role: SchoolRole.ENSEIGNANT,
    temporaryPassword,
  };
}

// Compte Parent : lié à un ou plusieurs élèves déjà existants dans cette
// école (fratrie). Volontairement AUCUNE SchoolMembership n'est créée ici —
// voir le commentaire sur l'enum SchoolRole dans schema.prisma : un parent
// n'est jamais un "membre" au sens large de l'école, son accès passe
// uniquement par les liens StudentGuardian créés ci-dessous (module
// parent-portal).
export async function createParentAccount(
  schoolId: string,
  input: { email: string; fullName: string; phone?: string; studentIds: string[] }
) {
  // Vérifie que chaque élève existe bien DANS cette école avant de créer quoi
  // que ce soit (même principe que assertStudentInSchool ailleurs dans le
  // projet) — 404 si l'un d'eux est absent/hors école.
  const students = await Promise.all(input.studentIds.map((id) => getStudent(schoolId, id)));

  const { user, temporaryPassword } = await createLinkedUser(input.email, input.fullName, input.phone);

  await prisma.$transaction(
    students.map((s) =>
      prisma.studentGuardian.create({ data: { userId: user.id, studentId: s.id } })
    )
  );

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    studentIds: students.map((s) => s.id),
    temporaryPassword,
  };
}

// Itération 31 — Compte Élève : lié à UN SEUL élève déjà existant dans
// cette école (contrairement au Parent, pas de tableau — voir
// Student.userId, FK 1-1, dans schema.prisma). Même choix qu'au Parent :
// AUCUNE SchoolMembership créée, l'accès passe uniquement par le FK direct
// mis à jour ci-dessous (module student-portal).
export async function createStudentAccount(
  schoolId: string,
  input: { email: string; fullName: string; phone?: string; studentId: string }
) {
  const student = await getStudent(schoolId, input.studentId); // 404 si absent/hors école
  if (student.userId) {
    throw ApiError.conflict("Cet élève est déjà lié à un compte de connexion.");
  }

  const { user, temporaryPassword } = await createLinkedUser(input.email, input.fullName, input.phone);

  await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    studentId: student.id,
    temporaryPassword,
  };
}
