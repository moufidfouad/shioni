import { useMemo, useState } from "react";
import { Formik, Form, FormikHelpers, useField } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import FormDialog from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextInputField, SelectField } from "@/components/form";
import { useContactsQuery, useCreateConversationMutation } from "../api";
import type { MessagingContact } from "@/types";

const KIND_LABEL: Record<MessagingContact["kind"], string> = {
  STAFF: "Personnel",
  PARENT: "Parent",
  STUDENT: "Élève",
};

interface FormValues {
  mode: "PRIVATE" | "GROUP";
  privateContactId: string;
  groupParticipantIds: string[];
  title: string;
}

const emptyValues: FormValues = { mode: "PRIVATE", privateContactId: "", groupParticipantIds: [], title: "" };

const Schema = Yup.object({
  mode: Yup.mixed<"PRIVATE" | "GROUP">().oneOf(["PRIVATE", "GROUP"]).required(),
  privateContactId: Yup.string().when("mode", {
    is: "PRIVATE",
    then: (s) => s.required("Choisissez un destinataire."),
    otherwise: (s) => s.notRequired(),
  }),
  groupParticipantIds: Yup.array(Yup.string().required()).when("mode", {
    is: "GROUP",
    then: (s) => s.min(1, "Choisissez au moins un membre."),
    otherwise: (s) => s.notRequired(),
  }),
  title: Yup.string().when("mode", {
    is: "GROUP",
    then: (s) => s.trim().min(1, "Le groupe doit avoir un nom.").required("Le groupe doit avoir un nom."),
    otherwise: (s) => s.notRequired(),
  }),
});

// Sélecteur de membres avec recherche — un `CheckboxGroupField` générique
// (components/form/CheckboxGroupField.tsx) affiche TOUTES ses options sans
// filtre, adapté à un petit ensemble fermé (ex: les rôles d'un membre) mais
// pas à la liste des contacts d'une école qui peut compter des dizaines de
// personnes. Composant dédié à ce dialogue plutôt qu'une généralisation de
// `CheckboxGroupField` (seul consommateur de ce besoin dans le projet pour
// l'instant).
function ParticipantPicker({ name, contacts }: { name: string; contacts: MessagingContact[] }) {
  const [field, meta, helpers] = useField<string[]>(name);
  const [search, setSearch] = useState("");
  const values = field.value ?? [];
  const filtered = useMemo(
    () => contacts.filter((c) => c.fullName.toLowerCase().includes(search.trim().toLowerCase())),
    [contacts, search]
  );

  function toggle(id: string) {
    const next = values.includes(id) ? values.filter((v) => v !== id) : [...values, id];
    helpers.setValue(next);
    helpers.setTouched(true);
  }

  return (
    <div className="space-y-1.5">
      <Label>Membres du groupe</Label>
      <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Aucun contact.</p>
        ) : (
          filtered.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent">
              <Checkbox checked={values.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="flex-1 truncate">{c.fullName}</span>
              <Badge variant="secondary">{KIND_LABEL[c.kind]}</Badge>
            </label>
          ))
        )}
      </div>
      {meta.touched && meta.error && <p className="text-sm text-destructive">{meta.error}</p>}
    </div>
  );
}

export default function NewConversationDialog({
  schoolId,
  open,
  onOpenChange,
  onCreated,
}: {
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}) {
  const contactsQuery = useContactsQuery(schoolId);
  const createConversation = useCreateConversationMutation(schoolId);
  const contacts = contactsQuery.data ?? [];

  const contactOptions = contacts.map((c) => ({
    value: c.id,
    label: `${c.fullName} (${KIND_LABEL[c.kind]})`,
  }));

  async function handleSubmit(values: FormValues, helpers: FormikHelpers<FormValues>) {
    try {
      const conversation = await createConversation.mutateAsync(
        values.mode === "PRIVATE"
          ? { type: "PRIVATE", participantUserIds: [values.privateContactId] }
          : { type: "GROUP", participantUserIds: values.groupParticipantIds, title: values.title.trim() }
      );
      toast.success(values.mode === "PRIVATE" ? "Conversation ouverte." : "Groupe créé.");
      onOpenChange(false);
      onCreated(conversation.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Impossible de créer la conversation.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Nouvelle conversation">
      <Formik key={open ? "open" : "closed"} initialValues={emptyValues} validationSchema={Schema} onSubmit={handleSubmit}>
        {({ values, setFieldValue, isSubmitting }) => (
          <Form className="space-y-4" noValidate>
            <Tabs value={values.mode} onValueChange={(v) => setFieldValue("mode", v)}>
              <TabsList>
                <TabsTrigger value="PRIVATE">Message privé</TabsTrigger>
                <TabsTrigger value="GROUP">Groupe</TabsTrigger>
              </TabsList>
            </Tabs>

            {values.mode === "PRIVATE" ? (
              <SelectField
                name="privateContactId"
                label="Destinataire"
                options={contactOptions}
                placeholder="Choisir un contact…"
                searchPlaceholder="Rechercher un contact…"
                emptyMessage="Aucun contact trouvé."
              />
            ) : (
              <>
                <TextInputField name="title" label="Nom du groupe" />
                <ParticipantPicker name="groupParticipantIds" contacts={contacts} />
              </>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Création…" : "Créer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </FormDialog>
  );
}
