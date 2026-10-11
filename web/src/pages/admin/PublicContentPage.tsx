import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { AdminTestimonial, ContactMessage } from "@/types";
import {
  TestimonialUpsertPayload,
  useAdminTestimonialsQuery,
  useDeleteTestimonialMutation,
  useUpsertTestimonialMutation,
} from "@/features/testimonials/api";
import { useAdminContactMessagesQuery } from "@/features/contact/api";
import { useCrudTab } from "@/providers/hooks/useCrudTab";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import ErrorState from "@/components/ErrorState";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import FormDialog from "@/components/FormDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextInputField, TextAreaField, CheckboxField } from "@/components/form";
import { useAuth } from "@/providers/contexts/AuthContext/context";


function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

interface TestimonialValues {
  authorName: string;
  authorRole: string;
  content: string;
  order: string;
  published: boolean;
}

const emptyTestimonial: TestimonialValues = { authorName: "", authorRole: "", content: "", order: "0", published: true };

const TestimonialSchema = Yup.object({
  authorName: Yup.string().trim().min(2, "2 caractères minimum").required("Le nom est requis."),
  authorRole: Yup.string().trim().min(2, "2 caractères minimum").required("Le rôle est requis."),
  content: Yup.string().trim().min(10, "10 caractères minimum").required("Le témoignage est requis."),
  order: Yup.number().typeError("Nombre requis.").optional(),
  published: Yup.boolean().required(),
});

function TestimonialsTab() {
  const testimonialsQuery = useAdminTestimonialsQuery();
  const upsert = useUpsertTestimonialMutation();
  const del = useDeleteTestimonialMutation();
  const testimonials = testimonialsQuery.data ?? [];

  const {
    showForm,
    setShowForm,
    editingId,
    values,
    pendingDelete,
    setPendingDelete,
    startCreate,
    startEdit,
    handleSubmit,
    confirmDelete,
  } = useCrudTab<AdminTestimonial, TestimonialValues, TestimonialUpsertPayload>({
    emptyValues: emptyTestimonial,
    toFormValues: (t) => ({
      authorName: t.authorName,
      authorRole: t.authorRole,
      content: t.content,
      order: String(t.order),
      published: t.published,
    }),
    toPayload: (v, editingId) => ({
      id: editingId ?? undefined,
      authorName: v.authorName,
      authorRole: v.authorRole,
      content: v.content,
      order: v.order ? Number(v.order) : 0,
      published: v.published,
    }),
    upsert,
    del,
    labels: {
      createSuccess: "Témoignage ajouté.",
      updateSuccess: "Témoignage mis à jour.",
      deleteSuccess: "Témoignage supprimé.",
    },
  });

  const editingTestimonial = testimonials.find((t) => t.id === editingId);

  const columns: DataTableColumn<AdminTestimonial>[] = [
    { header: "Auteur", cell: (t) => <span className="font-medium">{t.authorName}</span> },
    { header: "Rôle", cell: (t) => <span className="text-muted-foreground">{t.authorRole}</span> },
    {
      header: "Témoignage",
      cell: (t) => <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">{t.content}</span>,
    },
    { header: "Ordre", cell: (t) => t.order },
    {
      header: "Statut",
      cell: (t) =>
        t.published ? <StatusBadge tone="success" label="Publié" /> : <StatusBadge tone="neutral" label="Non publié" />,
    },
  ];

  if (testimonialsQuery.isError) {
    return <ErrorState onRetry={() => testimonialsQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Affichés dans le carrousel de la landing page (voir <code className="text-xs">TestimonialsCarousel.tsx</code>),
          seuls les témoignages « Publié » y apparaissent.
        </p>
        <Button size="sm" onClick={startCreate}>
          + Nouveau témoignage
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={testimonials}
        rowKey={(t) => t.id}
        loading={testimonialsQuery.isLoading}
        emptyMessage="Aucun témoignage pour l'instant."
        rowActions={(t) => (
          <>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => startEdit(t)}>
              Modifier
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-3 text-destructive"
              onClick={() => setPendingDelete(t.id)}
            >
              Supprimer
            </Button>
          </>
        )}
      />

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? "Modifier le témoignage" : "Nouveau témoignage"}
        description={editingId ? `Modification du témoignage de ${editingTestimonial?.authorName ?? ""}.` : undefined}
      >
        <Formik key={editingId ?? "create"} initialValues={values} validationSchema={TestimonialSchema} onSubmit={handleSubmit}>
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <TextInputField name="authorName" label="Nom de l'auteur" placeholder="ex : Mme CHOUZOUR Fatima" />
              <TextInputField name="authorRole" label="Rôle" placeholder="ex : Directrice, Collège Al-Camar" />
              <TextAreaField name="content" label="Témoignage" rows={4} />
              <TextInputField name="order" type="number" label="Ordre d'affichage" />
              <CheckboxField name="published" label="Publié (visible sur la landing page)" />
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </FormDialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer ce témoignage ?"
        description="Il disparaîtra immédiatement du carrousel de la landing page. Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </div>
  );
}

function ContactMessagesTab() {
  const messagesQuery = useAdminContactMessagesQuery();
  const messages = messagesQuery.data ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const columns: DataTableColumn<ContactMessage>[] = [
    { header: "Reçu le", cell: (m) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt)}</span> },
    { header: "Nom", cell: (m) => <span className="font-medium">{m.name}</span> },
    { header: "Email", cell: (m) => <span className="text-muted-foreground">{m.email}</span> },
    { header: "Sujet", cell: (m) => m.subject },
  ];

  if (messagesQuery.isError) {
    return <ErrorState onRetry={() => messagesQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Messages envoyés depuis le formulaire de contact public (lecture seule).
      </p>
      <DataTable
        columns={columns}
        data={messages}
        rowKey={(m) => m.id}
        loading={messagesQuery.isLoading}
        emptyMessage="Aucun message reçu pour l'instant."
        searchable
        searchPlaceholder="Rechercher un nom, un email, un sujet…"
        getSearchValue={(m) => `${m.name} ${m.email} ${m.subject}`}
        isRowExpanded={(m) => expandedId === m.id}
        rowActions={(m) => (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
            {expandedId === m.id ? "Masquer" : "Voir le message"}
          </Button>
        )}
        renderExpandedRow={(m) => (
          <div className="whitespace-pre-wrap px-4 py-3 text-sm text-foreground">{m.message}</div>
        )}
      />
    </div>
  );
}

export default function PublicContentPage() {
  const { user } = useAuth();

  if (!user?.isSuperAdmin) {
    return <Navigate to="/schools" replace />;
  }

  return (
    <div>
      <Navbar />
      <PageTransition>
        <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
          <PageHeader
            title="Contenu public"
            description="Témoignages de la landing page et messages du formulaire de contact — réservé au superadmin."
          />

          <Tabs defaultValue="testimonials">
            <TabsList>
              <TabsTrigger value="testimonials">Témoignages</TabsTrigger>
              <TabsTrigger value="contact-messages">Messages de contact</TabsTrigger>
            </TabsList>
            <TabsContent value="testimonials" className="mt-4">
              <TestimonialsTab />
            </TabsContent>
            <TabsContent value="contact-messages" className="mt-4">
              <ContactMessagesTab />
            </TabsContent>
          </Tabs>
        </main>
      </PageTransition>
    </div>
  );
}

