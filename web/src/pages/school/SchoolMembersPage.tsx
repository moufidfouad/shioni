import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { FormikHelpers } from "formik";
import { toast } from "sonner";
import { Member, SchoolRole } from "@/types";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import {
  useAddMemberMutation,
  useCreateParentAccountMutation,
  useCreateStudentAccountMutation,
  useCreateTeacherAccountMutation,
  useMembersQuery,
  useRemoveMemberMutation,
  useResetMemberPasswordMutation,
  useUpdateMemberRolesMutation,
} from "@/features/members/api";
import { useStaffQuery } from "@/features/personnel/api";
import { useStudentsQuery } from "@/features/students/api";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import { groupeLabelById } from "@/lib/groupeLabel";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import { ALL_ROLES } from "@/features/members/roles";
import AddMemberDialog, {
  AddMemberValues,
} from "@/features/members/components/AddMemberDialog";
import CreateTeacherAccountDialog, {
  CreateTeacherValues,
} from "@/features/members/components/CreateTeacherAccountDialog";
import CreateParentAccountDialog, {
  CreateParentValues,
} from "@/features/members/components/CreateParentAccountDialog";
import CreateStudentAccountDialog, {
  CreateStudentValues,
} from "@/features/members/components/CreateStudentAccountDialog";

const ALL_ROLES_VALUE = "__all__";

// Résultat d'une action qui révèle un mot de passe temporaire une seule fois
// (réinitialisation, ou création de compte Enseignant/Parent) — un seul état
// et une seule alerte pour les trois cas plutôt que d'en dupliquer l'UX.
interface CredentialResult {
  kind: "reset" | "teacher" | "parent" | "student";
  fullName: string;
  temporaryPassword: string;
}


export default function SchoolMembers() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const membersQuery = useMembersQuery(school.id);
  const addMember = useAddMemberMutation(school.id);
  const updateRoles = useUpdateMemberRolesMutation(school.id);
  const removeMember = useRemoveMemberMutation(school.id);
  const resetPassword = useResetMemberPasswordMutation(school.id);
  const createTeacherAccount = useCreateTeacherAccountMutation(school.id);
  const createParentAccount = useCreateParentAccountMutation(school.id);
  const createStudentAccount = useCreateStudentAccountMutation(school.id);

  const staffQuery = useStaffQuery(school.id, {}, { all: true });
  const studentsQuery = useStudentsQuery(school.id, {}, { all: true });
  const parametersQuery = useSchoolParametersQuery(school.id);
  const groupes = parametersQuery.data?.groupes ?? [];
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];
  const [roleFilter, setRoleFilter] = useState<SchoolRole | "">("");
  const [pendingRemoveUserId, setPendingRemoveUserId] = useState<string | null>(
    null,
  );
  const [credentialResult, setCredentialResult] =
    useState<CredentialResult | null>(null);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [showCreateTeacherForm, setShowCreateTeacherForm] = useState(false);
  const [showCreateParentForm, setShowCreateParentForm] = useState(false);
  const [showCreateStudentForm, setShowCreateStudentForm] = useState(false);

  const members = membersQuery.data ?? [];
  const filteredMembers = useMemo(() => {
    if (!roleFilter) return members;
    return members.filter((m) => m.roles.includes(roleFilter));
  }, [members, roleFilter]);


  const staffOptions = useMemo(
    () =>
      (staffQuery.data?.data ?? [])
        .filter((s) => !s.userId)
        .map((s) => ({
          value: s.id,
          label: s.fonction ? `${s.fullName} · ${s.fonction}` : s.fullName,
        })),
    [staffQuery.data],
  );

  const studentOptions = useMemo(
    () =>
      (studentsQuery.data?.data ?? []).map((s) => ({
        value: s.id,
        label: s.groupe
          ? `${s.fullName} · ${groupeLabelById(s.groupe.id, groupes, classes, series, s.groupe.name)}`
          : s.fullName,
      })),
    [studentsQuery.data, groupes, classes, series],
  );


  const studentAccountOptions = useMemo(
    () =>
      (studentsQuery.data?.data ?? [])
        .filter((s) => !s.userId)
        .map((s) => ({
          value: s.id,
          label: s.groupe
            ? `${s.fullName} · ${groupeLabelById(s.groupe.id, groupes, classes, series, s.groupe.name)}`
            : s.fullName,
        })),
    [studentsQuery.data, groupes, classes, series],
  );

  async function handleAdd(
    values: AddMemberValues,
    helpers: FormikHelpers<AddMemberValues>,
  ) {
    try {
      await addMember.mutateAsync({ email: values.email, roles: values.roles });
      toast.success("Utilisateur ajouté.");
      helpers.resetForm();
      setShowAddMemberForm(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Impossible d'ajouter cet utilisateur.",
      );
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function onToggleMemberRole(
    userId: string,
    role: SchoolRole,
    currentRoles: SchoolRole[],
  ) {
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];
    try {
      await updateRoles.mutateAsync({ userId, roles: nextRoles });
      toast.success("Rôles mis à jour.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Mise à jour impossible.");
    }
  }


  async function onResetPassword(userId: string) {
    try {
      const result = await resetPassword.mutateAsync(userId);
      setCredentialResult({
        kind: "reset",
        fullName: result.fullName,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Réinitialisation impossible.");
    }
  }

  async function handleCreateTeacher(
    values: CreateTeacherValues,
    helpers: FormikHelpers<CreateTeacherValues>,
  ) {
    try {
      const result = await createTeacherAccount.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || undefined,
        staffMemberId: values.staffMemberId,
      });
      setCredentialResult({
        kind: "teacher",
        fullName: result.fullName,
        temporaryPassword: result.temporaryPassword,
      });
      toast.success("Compte Enseignant créé.");
      helpers.resetForm();
      setShowCreateTeacherForm(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Impossible de créer ce compte.",
      );
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function handleCreateParent(
    values: CreateParentValues,
    helpers: FormikHelpers<CreateParentValues>,
  ) {
    try {
      const result = await createParentAccount.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || undefined,
        studentIds: values.studentIds,
      });
      setCredentialResult({
        kind: "parent",
        fullName: result.fullName,
        temporaryPassword: result.temporaryPassword,
      });
      toast.success("Compte Parent créé.");
      helpers.resetForm();
      setShowCreateParentForm(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Impossible de créer ce compte.",
      );
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function handleCreateStudentAccount(
    values: CreateStudentValues,
    helpers: FormikHelpers<CreateStudentValues>,
  ) {
    try {
      const result = await createStudentAccount.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || undefined,
        studentId: values.studentId,
      });
      setCredentialResult({
        kind: "student",
        fullName: result.fullName,
        temporaryPassword: result.temporaryPassword,
      });
      toast.success("Compte Élève créé.");
      helpers.resetForm();
      setShowCreateStudentForm(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Impossible de créer ce compte.",
      );
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemoveUserId) return;
    try {
      await removeMember.mutateAsync(pendingRemoveUserId);
      toast.success("Membre retiré.");
      setPendingRemoveUserId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const columns: DataTableColumn<Member>[] = [
    {
      header: "Membre",
      cell: ({ user }) => (
        <div>
          <p className="font-medium">{user.fullName}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    {
      header: "Rôles",
      cell: ({ user, roles }) => (
        <div className="flex flex-wrap gap-4">
          {ALL_ROLES.map((role) => (
            <label
              key={role.value}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Checkbox
                checked={roles.includes(role.value)}
                onCheckedChange={() =>
                  onToggleMemberRole(user.id, role.value, roles)
                }
              />
              {role.label}
            </label>
          ))}
        </div>
      ),
    },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Utilisateurs & rôles"
        description={school.name}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setShowAddMemberForm(true)}
            >
              + Ajouter un utilisateur
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreateTeacherForm(true)}
            >
              + Créer un compte Enseignant
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreateParentForm(true)}
            >
              + Créer un compte Parent
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreateStudentForm(true)}
            >
              + Créer un compte Élève
            </Button>
          </>
        }
      />

      <Dialog
        open={credentialResult !== null}
        onOpenChange={(open) => !open && setCredentialResult(null)}
      >
        <DialogContent hideClose>
          <DialogHeader>
            <DialogTitle>
              {credentialResult?.kind === "reset"
                ? `Mot de passe temporaire pour ${credentialResult.fullName}`
                : credentialResult?.kind === "teacher"
                  ? `Compte Enseignant créé pour ${credentialResult.fullName}`
                  : credentialResult?.kind === "parent"
                    ? `Compte Parent créé pour ${credentialResult.fullName}`
                    : `Compte Élève créé pour ${credentialResult?.fullName}`}
            </DialogTitle>
            <DialogDescription>
              Communiquez-le vous-même à cette personne (de vive voix, par
              SMS...) — aucun email n'est envoyé. Il ne sera plus affiché
              ensuite.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted px-3 py-2 text-center font-mono text-lg tracking-wide text-foreground">
            {credentialResult?.temporaryPassword}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCredentialResult(null)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMemberDialog
        open={showAddMemberForm}
        onOpenChange={setShowAddMemberForm}
        onSubmit={handleAdd}
      />

      <CreateTeacherAccountDialog
        open={showCreateTeacherForm}
        onOpenChange={setShowCreateTeacherForm}
        staffOptions={staffOptions}
        staffLoading={staffQuery.isLoading}
        onSubmit={handleCreateTeacher}
      />

      <CreateParentAccountDialog
        open={showCreateParentForm}
        onOpenChange={setShowCreateParentForm}
        studentOptions={studentOptions}
        onSubmit={handleCreateParent}
      />

      <CreateStudentAccountDialog
        open={showCreateStudentForm}
        onOpenChange={setShowCreateStudentForm}
        studentOptions={studentAccountOptions}
        studentsLoading={studentsQuery.isLoading}
        onSubmit={handleCreateStudentAccount}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-sm">Membres de l'école</CardTitle>
          <Select
            value={roleFilter || ALL_ROLES_VALUE}
            onValueChange={(v) =>
              setRoleFilter(v === ALL_ROLES_VALUE ? "" : (v as SchoolRole))
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtrer par rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROLES_VALUE}>Tous les rôles</SelectItem>
              {ALL_ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredMembers}
            rowKey={(m) => m.user.id}
            loading={membersQuery.isLoading}
            emptyMessage={
              members.length === 0
                ? "Aucun membre pour l'instant."
                : "Aucun membre pour ce rôle."
            }
            rowActions={(m) => (
              <div className="flex items-center gap-3">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  disabled={resetPassword.isPending}
                  onClick={() => onResetPassword(m.user.id)}
                >
                  Réinitialiser le mot de passe
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setPendingRemoveUserId(m.user.id)}
                >
                  Retirer
                </Button>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingRemoveUserId !== null}
        onOpenChange={(open) => !open && setPendingRemoveUserId(null)}
        title="Retirer ce membre de l'école ?"
        description={
          <>
            {members.find((m) => m.user.id === pendingRemoveUserId)?.user
              .fullName ?? "Ce membre"}{" "}
            perdra tous ses rôles et l'accès à cette école.
          </>
        }
        confirmLabel="Retirer"
        onConfirm={confirmRemove}
        loading={removeMember.isPending}
      />
    </PageTransition>
  );
}
