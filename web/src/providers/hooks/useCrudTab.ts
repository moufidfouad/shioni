import { useState } from "react";
import { FormikHelpers } from "formik";
import { toast } from "sonner";

// Itération 52 (Étape 3 de la refonte frontend) — extrait le squelette CRUD
// répété IDENTIQUEMENT 6 fois dans StructurePage.tsx (CyclesTab, ClassesTab,
// SeriesTab, GroupesTab, SallesTab, SchoolYearsTab) : état
// showForm/editingId/values/pendingDelete + startCreate/startEdit/
// handleSubmit/confirmDelete. Comportement strictement identique à l'inline
// d'origine — ce hook ne change AUCUNE règle métier, seulement l'endroit où
// le code vit.
//
// Itération 52 (Étape 3) : portée volontairement limitée à un seul onglet
// migré (CyclesTab) — l'audit (FRONTEND-AUDIT-ETAPE1.md, risques de la
// refonte) préconise explicitement de migrer un onglet à la fois, Cycle en
// premier puisque les 5 autres en dépendent en cascade (Cycle -> Classe ->
// Série -> Groupe, + Salle), et de ne jamais faire les 6 en un seul commit.
//
// Itération 56 (Étape 4, Vague 3) : les 5 onglets restants (Classe, Série,
// Groupe, Salle, Année scolaire) sont migrés à leur tour, dans cet ordre —
// toujours un à la fois, jamais en un seul commit, cascade respectée. Seul
// ajout au hook lui-même : `getCreateValues` (optionnel), nécessaire pour
// `SchoolYearsTab` dont le bouton de création pré-remplit `order` — voir ce
// champ ci-dessous pour le détail.
export interface UseCrudTabOptions<TItem extends { id: string }, TValues, TPayload> {
  emptyValues: TValues;
  toFormValues: (item: TItem) => TValues;
  toPayload: (values: TValues, editingId: string | null) => TPayload;
  upsert: { mutateAsync: (payload: TPayload) => Promise<unknown>; isPending: boolean };
  del: { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean };
  labels: {
    createSuccess: string;
    updateSuccess: string;
    deleteSuccess: string;
    saveError?: string;
    deleteError?: string;
  };
  // Itération 56 (Étape 4, Vague 3) — surcharge optionnelle des valeurs de
  // création, ajoutée pour `SchoolYearsTab` (StructurePage.tsx) : son bouton
  // "Nouvelle année scolaire" pré-remplit `order` avec le nombre d'années
  // déjà existantes (`schoolYears.length`), contrairement aux 5 autres
  // onglets qui repartent toujours de `emptyValues`. Sans ce champ (omis),
  // le comportement des onglets déjà migrés (Cycle, Classe, Série, Groupe,
  // Salle) reste strictement inchangé.
  getCreateValues?: () => TValues;
}

export interface UseCrudTabResult<TItem extends { id: string }, TValues> {
  showForm: boolean;
  setShowForm: (open: boolean) => void;
  editingId: string | null;
  values: TValues;
  pendingDelete: string | null;
  setPendingDelete: (id: string | null) => void;
  startCreate: () => void;
  startEdit: (item: TItem) => void;
  handleSubmit: (values: TValues, helpers: FormikHelpers<TValues>) => Promise<void>;
  confirmDelete: () => Promise<void>;
}

export function useCrudTab<TItem extends { id: string }, TValues, TPayload>({
  emptyValues,
  toFormValues,
  toPayload,
  upsert,
  del,
  labels,
  getCreateValues,
}: UseCrudTabOptions<TItem, TValues, TPayload>): UseCrudTabResult<TItem, TValues> {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<TValues>(emptyValues);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setValues(getCreateValues ? getCreateValues() : emptyValues);
    setShowForm(true);
  }

  function startEdit(item: TItem) {
    setEditingId(item.id);
    setValues(toFormValues(item));
    setShowForm(true);
  }

  async function handleSubmit(v: TValues, helpers: FormikHelpers<TValues>) {
    try {
      await upsert.mutateAsync(toPayload(v, editingId));
      toast.success(editingId ? labels.updateSuccess : labels.createSuccess);
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || labels.saveError || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await del.mutateAsync(pendingDelete);
      toast.success(labels.deleteSuccess);
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || labels.deleteError || "Suppression impossible.");
    }
  }

  return { showForm, setShowForm, editingId, values, pendingDelete, setPendingDelete, startCreate, startEdit, handleSubmit, confirmDelete };
}
