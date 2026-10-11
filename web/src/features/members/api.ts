import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Member, SchoolRole } from "@/types";

export const membersKeys = {
  list: (schoolId: string) => ["members", schoolId] as const,
};

export function useMembersQuery(schoolId: string) {
  return useQuery({
    queryKey: membersKeys.list(schoolId),
    queryFn: async ({ signal }) => (await api.get<Member[]>(`/schools/${schoolId}/members`, { signal })).data,
  });
}

function useInvalidateMembers(schoolId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: membersKeys.list(schoolId) });
}

export function useAddMemberMutation(schoolId: string) {
  const invalidate = useInvalidateMembers(schoolId);
  return useMutation({
    mutationFn: async (payload: { email: string; roles: SchoolRole[] }) =>
      (await api.post(`/schools/${schoolId}/members`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateMemberRolesMutation(schoolId: string) {
  const invalidate = useInvalidateMembers(schoolId);
  return useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: SchoolRole[] }) =>
      (await api.patch(`/schools/${schoolId}/members/${userId}`, { roles })).data,
    onSuccess: invalidate,
  });
}

export function useRemoveMemberMutation(schoolId: string) {
  const invalidate = useInvalidateMembers(schoolId);
  return useMutation({
    mutationFn: async (userId: string) => (await api.delete(`/schools/${schoolId}/members/${userId}`)).data,
    onSuccess: invalidate,
  });
}

export interface ResetPasswordResult {
  id: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
}

// Réinitialisation assistée par un ADMIN/superadmin — demande explicite :
// "un utilisateur doit pouvoir ... récupérer son mot de passe en cas
// d'oubli". Aucun service d'email dans ce projet (voir
// members.service.ts::resetMemberPassword côté backend) : le mot de passe
// temporaire généré revient dans la réponse, à communiquer de vive voix par
// la personne qui déclenche la réinitialisation. Pas d'invalidation de
// cache nécessaire : ça ne change ni la liste des membres ni leurs rôles.
export function useResetMemberPasswordMutation(schoolId: string) {
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.post<ResetPasswordResult>(`/schools/${schoolId}/members/${userId}/reset-password`)).data,
  });
}

// Itération 27 — création ASSISTÉE (par un ADMIN) de comptes Enseignant/
// Parent, distincte de `useAddMemberMutation` qui suppose un compte déjà
// créé par la personne elle-même. Même patron que la réinitialisation de
// mot de passe : le mot de passe temporaire ne revient qu'une fois, dans la
// réponse de la mutation.
export interface CreateAccountResult {
  userId: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
}

export function useCreateTeacherAccountMutation(schoolId: string) {
  const invalidate = useInvalidateMembers(schoolId);
  return useMutation({
    mutationFn: async (payload: { email: string; fullName: string; phone?: string; staffMemberId: string }) =>
      (await api.post<CreateAccountResult>(`/schools/${schoolId}/members/teacher-account`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useCreateParentAccountMutation(schoolId: string) {
  return useMutation({
    mutationFn: async (payload: { email: string; fullName: string; phone?: string; studentIds: string[] }) =>
      (
        await api.post<CreateAccountResult>(`/schools/${schoolId}/members/parent-account`, payload)
      ).data,
    // Pas d'invalidation de `members` : un compte Parent n'apparaît jamais
    // dans la liste des membres (aucune SchoolMembership) — voir
    // schema.prisma::StudentGuardian.
  });
}

// Itération 31 — idem, compte Élève : un seul `studentId` (pas un tableau,
// voir Student.userId côté backend). Pas d'invalidation de `members` non
// plus, pour la même raison qu'un compte Parent.
export function useCreateStudentAccountMutation(schoolId: string) {
  return useMutation({
    mutationFn: async (payload: { email: string; fullName: string; phone?: string; studentId: string }) =>
      (
        await api.post<CreateAccountResult>(`/schools/${schoolId}/members/student-account`, payload)
      ).data,
  });
}
