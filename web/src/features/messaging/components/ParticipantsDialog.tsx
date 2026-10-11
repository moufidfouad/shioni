import { useState } from "react";
import { toast } from "sonner";
import { UserMinus, UserPlus } from "lucide-react";
import FormDialog from "@/components/FormDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectField } from "@/components/form";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import {
  useAddParticipantMutation,
  useContactsQuery,
  useConversationsQuery,
  useRemoveParticipantMutation,
} from "../api";

// Gestion des membres d'un groupe — réservée à l'administrateur (cadrage
// explicite de l'utilisateur : "pour les groupes, le créateur devient
// l'administrateur, peut ajouter/retirer des membres", voir schema.prisma::
// ParticipantRole). N'apparaît dans ChatWindow que si `conversation.myRole
// === "ADMIN"` — ce dialogue ne revérifie donc pas ce rôle lui-même, le
// backend le fait de toute façon à chaque requête (messaging.service.ts::
// assertGroupAdmin), en dernier recours contre un contournement côté client.
export default function ParticipantsDialog({
  schoolId,
  conversationId,
  open,
  onOpenChange,
}: {
  schoolId: string;
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const conversationsQuery = useConversationsQuery(schoolId);
  const contactsQuery = useContactsQuery(schoolId);
  const addParticipant = useAddParticipantMutation(schoolId, conversationId);
  const removeParticipant = useRemoveParticipantMutation(schoolId, conversationId);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const conversation = conversationsQuery.data?.find((c) => c.id === conversationId);
  const participantIds = new Set(conversation?.participants.map((p) => p.userId) ?? []);
  const addableContacts = (contactsQuery.data ?? []).filter((c) => !participantIds.has(c.id));

  async function handleAdd(values: { userId: string }, helpers: { resetForm: () => void; setSubmitting: (b: boolean) => void }) {
    try {
      await addParticipant.mutateAsync(values.userId);
      toast.success("Membre ajouté.");
      helpers.resetForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Ajout impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemoveId) return;
    try {
      await removeParticipant.mutateAsync(pendingRemoveId);
      toast.success("Membre retiré.");
      setPendingRemoveId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Retrait impossible.");
    }
  }

  return (
    <>
      <FormDialog open={open} onOpenChange={onOpenChange} title="Membres du groupe">
        <div className="space-y-4">
          <div className="max-h-56 overflow-y-auto rounded-md border">
            {conversation?.participants.map((p) => (
              <div key={p.userId} className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                <span className="truncate">{p.fullName}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {p.role === "ADMIN" && <Badge variant="secondary">Admin</Badge>}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Retirer du groupe"
                    onClick={() => setPendingRemoveId(p.userId)}
                  >
                    <UserMinus className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Formik initialValues={{ userId: "" }} validationSchema={Yup.object({ userId: Yup.string().required() })} onSubmit={handleAdd}>
            {({ isSubmitting }) => (
              <Form className="flex items-end gap-2" noValidate>
                <SelectField
                  name="userId"
                  label="Ajouter un membre"
                  wrapperClassName="flex-1"
                  options={addableContacts.map((c) => ({ value: c.id, label: c.fullName }))}
                  placeholder="Choisir une personne…"
                  emptyMessage="Aucun contact disponible."
                />
                <Button type="submit" disabled={isSubmitting} size="icon" title="Ajouter">
                  <UserPlus className="size-4" />
                </Button>
              </Form>
            )}
          </Formik>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(pendingRemoveId)}
        onOpenChange={(next) => !next && setPendingRemoveId(null)}
        title="Retirer ce membre ?"
        description="Il ne recevra plus les messages de ce groupe."
        onConfirm={confirmRemove}
        loading={removeParticipant.isPending}
      />
    </>
  );
}
