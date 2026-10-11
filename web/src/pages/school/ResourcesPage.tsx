import { useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { Resource } from "@/types";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import { useSubjectsQuery } from "@/features/subjects/api";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_ALLOWED_MIME_TYPES,
  useCreateDocumentResourceMutation,
  useCreateVideoResourceMutation,
  useDeleteResourceMutation,
  useResourcesQuery,
  useUpdateResourceMutation,
  resourceDownloadUrl,
} from "@/features/resources/api";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FormDialog from "@/components/FormDialog";
import PageHeader from "@/components/PageHeader";
import UploadProgress from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TextInputField, TextAreaField, CheckboxField, CheckboxGroupField } from "@/components/form";
import PageTransition from "@/components/motion/PageTransition";

interface CommonFormValues {
  title: string;
  description: string;
  subjectIds: string[];
  classeIds: string[];
  published: boolean;
}

const emptyCommonValues: CommonFormValues = {
  title: "",
  description: "",
  subjectIds: [],
  classeIds: [],
  published: true,
};

const CommonSchema = Yup.object({
  title: Yup.string().trim().min(2, "2 caractères minimum").required("Le titre est requis."),
  description: Yup.string().optional(),
  subjectIds: Yup.array().of(Yup.string()).min(1, "Choisissez au moins une matière.").required(),
  classeIds: Yup.array().of(Yup.string()).min(1, "Choisissez au moins une classe.").required(),
  published: Yup.boolean().required(),
});

interface VideoFormValues extends CommonFormValues {
  videoUrl: string;
}

const emptyVideoValues: VideoFormValues = { ...emptyCommonValues, videoUrl: "" };

const VideoSchema = CommonSchema.shape({
  videoUrl: Yup.string().url("URL invalide.").required("Le lien de la vidéo est requis."),
});

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ResourcesPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const resourcesQuery = useResourcesQuery(school.id);
  const parametersQuery = useSchoolParametersQuery(school.id);
  const subjectsQuery = useSubjectsQuery(school.id);

  const createDocument = useCreateDocumentResourceMutation(school.id);
  const createVideo = useCreateVideoResourceMutation(school.id);
  const updateResource = useUpdateResourceMutation(school.id);
  const deleteResource = useDeleteResourceMutation(school.id);

  const resources = resourcesQuery.data ?? [];
  const classes = parametersQuery.data?.classes ?? [];
  const subjects = subjectsQuery.data ?? [];
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));
  const classeOptions = classes.map((c) => ({ value: c.id, label: c.name }));

  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  function startCreateDocument() {
    setSelectedFile(null);
    setUploadProgress(null);
    setShowDocumentForm(true);
  }


  function handleFileSelect(file: File | null) {
    if (file && !DOCUMENT_ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("Type de fichier non autorisé.");
      return;
    }
    setSelectedFile(file);
  }

  async function handleCreateDocument(values: CommonFormValues, helpers: FormikHelpers<CommonFormValues>) {
    if (!selectedFile) {
      toast.error("Choisissez un fichier à publier.");
      helpers.setSubmitting(false);
      return;
    }
    setUploadProgress(0);
    try {
      await createDocument.mutateAsync({ ...values, file: selectedFile, onUploadProgress: setUploadProgress });
      toast.success("Document publié.");
      setShowDocumentForm(false);
      setSelectedFile(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Publication impossible.");
    } finally {
      helpers.setSubmitting(false);
      setUploadProgress(null);
    }
  }

  async function handleCreateVideo(values: VideoFormValues, helpers: FormikHelpers<VideoFormValues>) {
    try {
      await createVideo.mutateAsync(values);
      toast.success("Vidéo publiée.");
      setShowVideoForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Publication impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function handleUpdate(values: VideoFormValues, helpers: FormikHelpers<VideoFormValues>) {
    if (!editingResource) return;
    try {
      await updateResource.mutateAsync({
        id: editingResource.id,
        payload: {
          title: values.title,
          description: values.description,
          published: values.published,
          subjectIds: values.subjectIds,
          classeIds: values.classeIds,
          ...(editingResource.type === "VIDEO" ? { videoUrl: values.videoUrl } : {}),
        },
      });
      toast.success("Ressource mise à jour.");
      setEditingResource(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteResource.mutateAsync(pendingDeleteId);
      toast.success("Ressource supprimée.");
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const columns: DataTableColumn<Resource>[] = [
    {
      header: "Titre",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.title}</div>
          {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
        </div>
      ),
    },
    {
      header: "Type",
      cell: (r) => (
        <Badge variant={r.type === "DOCUMENT" ? "default" : "secondary"}>
          {r.type === "DOCUMENT" ? `Document${r.fileSize ? ` · ${formatSize(r.fileSize)}` : ""}` : "Vidéo"}
        </Badge>
      ),
    },
    {
      header: "Matières",
      cell: (r) => <span className="text-sm">{r.subjects.map((s) => s.subject.name).join(", ") || "—"}</span>,
    },
    {
      header: "Classes",
      cell: (r) => <span className="text-sm">{r.classes.map((c) => c.classe.name).join(", ") || "—"}</span>,
    },
    {
      header: "Statut",
      cell: (r) => <Badge variant={r.published ? "default" : "outline"}>{r.published ? "Publié" : "Masqué"}</Badge>,
    },
  ];

  function startEdit(resource: Resource) {
    setEditingResource(resource);
  }

  const editInitialValues: VideoFormValues | null = editingResource
    ? {
        title: editingResource.title,
        description: editingResource.description ?? "",
        subjectIds: editingResource.subjects.map((s) => s.subject.id),
        classeIds: editingResource.classes.map((c) => c.classe.id),
        published: editingResource.published,
        videoUrl: editingResource.videoUrl ?? "",
      }
    : null;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Ressources partagées"
        description="Documents et vidéos partagés au public — visibles sur la page publique une fois publiés."
        actions={
          <>
            <Button variant="outline" onClick={startCreateDocument}>
              + Nouveau document
            </Button>
            <Button onClick={() => setShowVideoForm(true)}>+ Nouvelle vidéo</Button>
          </>
        }
      />

      {/* Création — DOCUMENT (multipart, fichier + champs communs) */}
      <FormDialog open={showDocumentForm} onOpenChange={setShowDocumentForm} title="Nouveau document">
        <Formik initialValues={emptyCommonValues} validationSchema={CommonSchema} onSubmit={handleCreateDocument}>
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <TextInputField name="title" label="Titre" />
              <TextAreaField name="description" label="Description (optionnelle)" rows={2} />
              <div className="space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  hidden
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  {selectedFile ? "Changer le fichier" : "Choisir un fichier"}
                </Button>
                {selectedFile && <p className="text-sm text-muted-foreground">{selectedFile.name}</p>}
                {uploadProgress !== null && <UploadProgress percent={uploadProgress} label="Envoi en cours…" />}
              </div>
              <CheckboxGroupField name="subjectIds" label="Matières" options={subjectOptions} />
              <CheckboxGroupField name="classeIds" label="Classes" options={classeOptions} />
              <CheckboxField name="published" label="Publier immédiatement" />
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Publication…" : "Publier"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowDocumentForm(false)}>
                  Annuler
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </FormDialog>

      {/* Création — VIDEO (JSON, lien externe YouTube/Vimeo + champs communs) */}
      <FormDialog open={showVideoForm} onOpenChange={setShowVideoForm} title="Nouvelle vidéo">
        <Formik initialValues={emptyVideoValues} validationSchema={VideoSchema} onSubmit={handleCreateVideo}>
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <TextInputField name="title" label="Titre" />
              <TextAreaField name="description" label="Description (optionnelle)" rows={2} />
              <TextInputField name="videoUrl" label="Lien de la vidéo (YouTube/Vimeo)" placeholder="https://…" />
              <CheckboxGroupField name="subjectIds" label="Matières" options={subjectOptions} />
              <CheckboxGroupField name="classeIds" label="Classes" options={classeOptions} />
              <CheckboxField name="published" label="Publier immédiatement" />
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Publication…" : "Publier"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowVideoForm(false)}>
                  Annuler
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </FormDialog>

      <FormDialog
        open={editingResource !== null}
        onOpenChange={(open) => !open && setEditingResource(null)}
        title="Modifier la ressource"
      >
        {editInitialValues && (
          <Formik
            key={editingResource?.id}
            initialValues={editInitialValues}
            validationSchema={editingResource?.type === "VIDEO" ? VideoSchema : CommonSchema}
            onSubmit={handleUpdate}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4" noValidate>
                <TextInputField name="title" label="Titre" />
                <TextAreaField name="description" label="Description (optionnelle)" rows={2} />
                {editingResource?.type === "VIDEO" && (
                  <TextInputField name="videoUrl" label="Lien de la vidéo (YouTube/Vimeo)" placeholder="https://…" />
                )}
                <CheckboxGroupField name="subjectIds" label="Matières" options={subjectOptions} />
                <CheckboxGroupField name="classeIds" label="Classes" options={classeOptions} />
                <CheckboxField name="published" label="Publiée (visible sur la page publique)" />
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingResource(null)}>
                    Annuler
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        )}
      </FormDialog>

      <DataTable
        columns={columns}
        data={resources}
        rowKey={(r) => r.id}
        loading={resourcesQuery.isLoading}
        emptyMessage="Aucune ressource publiée pour l'instant."
        rowActions={(r) => (
          <>
            {r.type === "DOCUMENT" && (
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <a href={resourceDownloadUrl(school.id, r.id)} target="_blank" rel="noreferrer">
                  Télécharger
                </a>
              </Button>
            )}
            <Button variant="link" size="sm" className="h-auto p-0 pl-3" onClick={() => startEdit(r)}>
              Modifier
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-3 text-destructive"
              onClick={() => setPendingDeleteId(r.id)}
            >
              Supprimer
            </Button>
          </>
        )}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer cette ressource ?"
        description="Cette ressource sera retirée de la page publique et son fichier éventuel supprimé. Cette action est irréversible."
        onConfirm={confirmDelete}
        loading={deleteResource.isPending}
      />
    </PageTransition>
  );
}
