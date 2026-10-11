import { useState } from "react";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { School as SchoolIcon } from "lucide-react";
import { COMOROS_ISLANDS, School, SchoolParameters } from "@/types";
import {
  schoolLogoUrl,
  useDeleteSchoolLogoMutation,
  useUpdateSchoolMutation,
  useUploadSchoolLogoMutation,
} from "../../features/schools/api";
import {
  useDeleteFeeLevelMutation,
  useSavePedagogyMutation,
  useSchoolParametersQuery,
  useSetFeeLevelsMutation,
} from "../../features/parameters/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextInputField, SelectField } from "@/components/form";
import ConfirmDialog from "../../components/ConfirmDialog";
import FormDialog from "../../components/FormDialog";
import PhotoManagerDialog from "../../components/PhotoManagerDialog";
import PageHeader from "../../components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";

interface PedagogyValues {
  noteMax: string;
  notePassage: string;
  nbTrimestres: string;
  trimestreEnCours: string;
  nbHeuresSemaine: string;
  seuilBien: string;
  seuilTresBien: string;
  seuilExcellent: string;
}

const PEDAGOGY_FIELDS: [keyof PedagogyValues, string][] = [
  ["noteMax", "Note maximale"],
  ["notePassage", "Note de passage"],
  ["nbTrimestres", "Nb de trimestres"],
  ["trimestreEnCours", "Trimestre en cours"],
  ["nbHeuresSemaine", "Heures / semaine"],
  ["seuilBien", "Seuil mention Bien"],
  ["seuilTresBien", "Seuil mention Très Bien"],
  ["seuilExcellent", "Seuil mention Excellent"],
];

const numberField = Yup.number().typeError("Nombre requis.").required("Champ requis.");

const PedagogySchema = Yup.object({
  noteMax: numberField,
  notePassage: numberField,
  nbTrimestres: numberField,
  trimestreEnCours: numberField,
  nbHeuresSemaine: numberField,
  seuilBien: numberField,
  seuilTresBien: numberField,
  seuilExcellent: numberField,
});

function toPedagogyValues(p: SchoolParameters): PedagogyValues {
  return {
    noteMax: String(p.noteMax),
    notePassage: String(p.notePassage),
    nbTrimestres: String(p.nbTrimestres),
    trimestreEnCours: String(p.trimestreEnCours),
    nbHeuresSemaine: String(p.nbHeuresSemaine),
    seuilBien: String(p.seuilBien),
    seuilTresBien: String(p.seuilTresBien),
    seuilExcellent: String(p.seuilExcellent),
  };
}

interface FeeLevelValues {

  classeId: string;
  amount: string;

  monthlyAmount: string;
}

const emptyFeeLevel: FeeLevelValues = { classeId: "", amount: "", monthlyAmount: "" };

const FeeLevelSchema = Yup.object({
  classeId: Yup.string().required("La classe est requise."),
  amount: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").required("Le montant est requis."),
  monthlyAmount: Yup.number().typeError("Nombre requis.").min(0, "Doit être positif.").optional(),
});


interface SchoolInfoValues {
  name: string;
  director: string;
  island: string;
  address: string;
  phone: string;
  email: string;
  arreteNumber: string;
  currency: string;
  cycle: string;
}

function toSchoolInfoValues(s: School): SchoolInfoValues {
  return {
    name: s.name ?? "",
    director: s.director ?? "",
    island: s.island ?? "",
    address: s.address ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    arreteNumber: s.arreteNumber ?? "",
    currency: s.currency ?? "",
    cycle: s.cycle ?? "",
  };
}

const SchoolInfoSchema = Yup.object({
  name: Yup.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").required("Le nom est requis."),
  director: Yup.string().optional(),
  island: Yup.string().optional(),
  address: Yup.string().optional(),
  phone: Yup.string().optional(),
  email: Yup.string().email("Email invalide."),
  arreteNumber: Yup.string().optional(),
  currency: Yup.string().optional(),
  cycle: Yup.string().optional(),
});

// Reflète la feuille "PARAMETRES" : paramètres pédagogiques, frais par
// niveau, classes & effectifs cibles. Réservé aux ADMIN (contrôlé par
// RBAC côté route + côté API). Les 3 formulaires de cette page utilisent
// Formik + Yup.
export default function SchoolSettings() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const updateSchool = useUpdateSchoolMutation(school.id);
  const parametersQuery = useSchoolParametersQuery(school.id);
  const savePedagogy = useSavePedagogyMutation(school.id);
  const setFeeLevels = useSetFeeLevelsMutation(school.id);
  const deleteFeeLevel = useDeleteFeeLevelMutation(school.id);
  const uploadSchoolLogo = useUploadSchoolLogoMutation(school.id);
  const deleteSchoolLogo = useDeleteSchoolLogoMutation(school.id);

  const [showLogoDialog, setShowLogoDialog] = useState(false);

  const params = parametersQuery.data;

  const [pendingDeleteLevelId, setPendingDeleteLevelId] = useState<string | null>(null);

  const [editingLevelClasseId, setEditingLevelClasseId] = useState<string | null>(null);
  const [levelFormValues, setLevelFormValues] = useState<FeeLevelValues>(emptyFeeLevel);
  const [showLevelForm, setShowLevelForm] = useState(false);

  async function handleSaveSchoolInfo(values: SchoolInfoValues, helpers: FormikHelpers<SchoolInfoValues>) {
    try {
      await updateSchool.mutateAsync({
        name: values.name,
        director: values.director || undefined,
        island: values.island || undefined,
        address: values.address || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        arreteNumber: values.arreteNumber || undefined,
        currency: values.currency || undefined,
        cycle: values.cycle || undefined,
      });
      toast.success("Informations de l'école mises à jour.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function handleSavePedagogy(values: PedagogyValues, helpers: FormikHelpers<PedagogyValues>) {
    try {
      await savePedagogy.mutateAsync({
        noteMax: Number(values.noteMax),
        notePassage: Number(values.notePassage),
        nbTrimestres: Number(values.nbTrimestres),
        trimestreEnCours: Number(values.trimestreEnCours),
        nbHeuresSemaine: Number(values.nbHeuresSemaine),
        seuilBien: Number(values.seuilBien),
        seuilTresBien: Number(values.seuilTresBien),
        seuilExcellent: Number(values.seuilExcellent),
      });
      toast.success("Paramètres pédagogiques enregistrés.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  function startEditLevel(level: { classeId: string; amount: string; monthlyAmount?: string | null }) {
    setEditingLevelClasseId(level.classeId);
    setLevelFormValues({
      classeId: level.classeId,
      amount: level.amount,
      monthlyAmount: level.monthlyAmount || "",
    });
    setShowLevelForm(true);
  }

  function startCreateLevel() {
    setEditingLevelClasseId(null);
    setLevelFormValues(emptyFeeLevel);
    setShowLevelForm(true);
  }

  function cancelEditLevel() {
    setEditingLevelClasseId(null);
    setLevelFormValues(emptyFeeLevel);
    setShowLevelForm(false);
  }

  // `useSetFeeLevelsMutation` renvoie TOUJOURS la liste complète (upsert en
  // masse, voir parameters.service.ts::upsertFeeLevels) : on reconstruit
  // donc systématiquement tous les niveaux existants, en ne remplaçant que
  // celui en cours d'édition (ou en ajoutant le nouveau si
  // `editingLevelClasseId` est `null`) — `FeeLevel` n'a pas d'endpoint
  // d'upsert unitaire côté API.
  async function handleSubmitLevel(values: FeeLevelValues, helpers: FormikHelpers<FeeLevelValues>) {
    if (!params) return;
    const monthlyAmount = values.monthlyAmount ? Number(values.monthlyAmount) : undefined;
    const others = params.feeLevels
      .filter((l) => l.classeId !== editingLevelClasseId)
      .map((l) => ({
        classeId: l.classeId,
        amount: Number(l.amount),
        monthlyAmount: l.monthlyAmount ? Number(l.monthlyAmount) : undefined,
      }));
    const levels = [...others, { classeId: values.classeId, amount: Number(values.amount), monthlyAmount }];
    try {
      await setFeeLevels.mutateAsync(levels);
      toast.success(editingLevelClasseId ? "Niveau mis à jour." : "Niveau ajouté.");
      helpers.resetForm();
      cancelEditLevel();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  async function confirmDeleteLevel() {
    if (!pendingDeleteLevelId) return;
    try {
      await deleteFeeLevel.mutateAsync(pendingDeleteLevelId);
      toast.success("Niveau supprimé.");
      setPendingDeleteLevelId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  if (parametersQuery.isLoading || !params) return <p className="text-muted-foreground">Chargement…</p>;

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Paramètres" description={school.name} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Informations de l'école</CardTitle>
          <div className="flex items-center gap-3">

            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {school.hasLogo ? (
                <img src={schoolLogoUrl(school.id)} alt="" className="size-full object-cover" />
              ) : (
                <SchoolIcon className="size-4 text-muted-foreground" aria-hidden />
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowLogoDialog(true)}>
              Gérer le logo
            </Button>
          </div>
        </CardHeader>
        <CardContent>

          <p className="mb-4 text-xs text-muted-foreground">
            L'année scolaire courante se gère sur la page{" "}
            <Link to={`/schools/${school.id}/structure`} className="underline underline-offset-2">
              Structure pédagogique
            </Link>
            , onglet « Années scolaires ».
          </p>
          <Formik
            initialValues={toSchoolInfoValues(school)}
            enableReinitialize
            validationSchema={SchoolInfoSchema}
            onSubmit={handleSaveSchoolInfo}
          >
            {({ isSubmitting }) => (
              <Form className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
                <TextInputField name="name" label="Nom de l'école" />
                <TextInputField name="director" label="Directeur / Directrice" />
                <SelectField
                  name="island"
                  label="Île"
                  clearable
                  options={COMOROS_ISLANDS.map((island) => ({ value: island, label: island }))}
                />
                <TextInputField name="address" label="Adresse" />
                <TextInputField name="phone" label="Téléphone" placeholder="+269 3XX XX XX" />
                <TextInputField name="email" label="Email" type="email" />
                <TextInputField name="arreteNumber" label="N° Arrêté d'ouverture" />
                <TextInputField name="currency" label="Devise" placeholder="KMF" />
                <TextInputField name="cycle" label="Cycle" placeholder="Secondaire général" />
                <div className="col-span-1 flex items-end sm:col-span-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Paramètres pédagogiques</CardTitle>
        </CardHeader>
        <CardContent>
          <Formik
            initialValues={toPedagogyValues(params)}
            enableReinitialize
            validationSchema={PedagogySchema}
            onSubmit={handleSavePedagogy}
          >
            {({ isSubmitting }) => (
              <Form className="grid grid-cols-2 gap-4 sm:grid-cols-4" noValidate>
                {PEDAGOGY_FIELDS.map(([key, label]) => (
                  <TextInputField key={key} name={key} label={label} type="number" />
                ))}
                <div className="col-span-2 flex items-end sm:col-span-4">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Frais scolaires par niveau</CardTitle>
          <Button size="sm" onClick={startCreateLevel}>
            + Ajouter un niveau
          </Button>
        </CardHeader>
        <CardContent>

          <p className="mb-4 text-xs text-muted-foreground">
            Les classes se créent sur la page{" "}
            <Link to={`/schools/${school.id}/structure`} className="underline underline-offset-2">
              Structure pédagogique
            </Link>
            . Chaque classe peut avoir ici un tarif de frais scolaires.
          </p>
          <ul className="divide-y">
            {params.feeLevels.map((level) => {
              const classe = params.classes.find((c) => c.id === level.classeId);
              return (
                <li key={level.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{classe?.name ?? "?"}</span>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">
                        {Number(level.amount).toLocaleString("fr-FR")} {school.currency}
                        <span className="ml-1 font-normal text-muted-foreground">/ an</span>
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {level.monthlyAmount
                          ? `${Number(level.monthlyAmount).toLocaleString("fr-FR")} ${school.currency} / mois`
                          : "Écolage mensuel non configuré"}
                      </p>
                    </div>
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => startEditLevel(level)}>
                      Modifier
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-destructive"
                      onClick={() => setPendingDeleteLevelId(level.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <FormDialog
        open={showLevelForm}
        onOpenChange={(open) => (open ? setShowLevelForm(true) : cancelEditLevel())}
        title={
          editingLevelClasseId
            ? `Modifier le niveau « ${params.classes.find((c) => c.id === editingLevelClasseId)?.name ?? ""} »`
            : "Ajouter un niveau"
        }
      >
        <Formik
          key={editingLevelClasseId ?? "create"}
          initialValues={levelFormValues}
          validationSchema={FeeLevelSchema}
          onSubmit={handleSubmitLevel}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-wrap items-start gap-2" noValidate>
              <SelectField
                name="classeId"
                placeholder="Classe"
                disabled={Boolean(editingLevelClasseId)}
                options={params.classes
                  .filter((c) => editingLevelClasseId === c.id || !params.feeLevels.some((l) => l.classeId === c.id))
                  .map((c) => ({ value: c.id, label: c.name }))}
                wrapperClassName="flex-1"
              />
              <TextInputField name="amount" type="number" placeholder="Droit d'inscription / an" wrapperClassName="w-40" />
              <TextInputField name="monthlyAmount" type="number" placeholder="Écolage / mois" wrapperClassName="w-36" />
              <Button type="submit" variant="secondary" disabled={isSubmitting}>
                {editingLevelClasseId ? "Enregistrer" : "Ajouter"}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEditLevel}>
                Annuler
              </Button>
            </Form>
          )}
        </Formik>
      </FormDialog>

      <ConfirmDialog
        open={pendingDeleteLevelId !== null}
        onOpenChange={(open) => !open && setPendingDeleteLevelId(null)}
        title="Supprimer ce niveau de frais ?"
        description={
          <>
            {params.classes.find((c) => c.id === params.feeLevels.find((l) => l.id === pendingDeleteLevelId)?.classeId)
              ?.name ?? "Ce niveau"}{" "}
            sera supprimé. Cette action est irréversible.
          </>
        }
        onConfirm={confirmDeleteLevel}
        loading={deleteFeeLevel.isPending}
      />

      <PhotoManagerDialog
        open={showLogoDialog}
        onOpenChange={setShowLogoDialog}
        title={`Logo — ${school.name}`}
        entityLabel={school.name}
        photoUrl={school.hasLogo ? schoolLogoUrl(school.id) : null}
        onUpload={(file, onProgress) => uploadSchoolLogo.mutateAsync({ file, onUploadProgress: onProgress })}
        onDelete={() => deleteSchoolLogo.mutateAsync()}
      />
    </PageTransition>
  );
}
