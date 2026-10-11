import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { useAuth } from "@/providers/contexts/AuthContext/context";
import { SchoolRole } from "@/types";
import {
  useCreateSchoolMutation,
  useSchoolsQuery,
} from "@/features/schools/api";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextInputField } from "@/components/form";
import PageTransition from "@/components/motion/PageTransition";
import { StaggerContainer, StaggerItem } from "@/components/motion/Stagger";

interface CreateSchoolValues {
  name: string;
}

const initialValues: CreateSchoolValues = { name: "" };

const CreateSchoolSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, "2 caractères minimum")
    .required("Le nom de l'école est requis."),
});

const ROLE_FILTER_OPTIONS: { value: SchoolRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "GESTION_ELEVES", label: "Gestion des élèves" },
  { value: "GESTION_NOTES", label: "Gestion des notes" },
  { value: "GESTION_FINANCES", label: "Gestion des finances" },
];
const ALL_ROLES_VALUE = "__all__";

// Page d'accueil : liste des écoles de l'utilisateur (ou de TOUTES les
// écoles s'il est superadmin) + formulaire de création. Communication avec
// l'API via React Query (`useSchoolsQuery`/`useCreateSchoolMutation`).
//
// Note : cette liste reste volontairement une grille de cartes (et non une
// DataTable paginée) — chaque école y est représentée visuellement (nom,
// année scolaire, compteurs, rôles), ce qui se prête mieux à une galerie de
// cartes qu'à un tableau de données brut ; les DataTables paginées sont
// utilisées pour les vraies listes tabulaires (élèves, matières, membres).
// Les filtres (nom, rôle) sont appliqués côté client : la liste des écoles
// d'un utilisateur reste, par nature, courte.
export default function SchoolsDashboard() {
  const { user } = useAuth();
  const schoolsQuery = useSchoolsQuery();
  const createSchool = useCreateSchoolMutation();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<SchoolRole | "">("");

  const schools = schoolsQuery.data ?? [];
  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const matchesSearch =
        !search.trim() ||
        school.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesRole =
        !roleFilter || (school.myRoles ?? []).includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [schools, search, roleFilter]);

  async function handleCreate(
    values: CreateSchoolValues,
    helpers: FormikHelpers<CreateSchoolValues>,
  ) {
    try {
      await createSchool.mutateAsync(values.name);
      toast.success("École créée.");
      helpers.resetForm();
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Création impossible.");
    } finally {
      helpers.setSubmitting(false);
    }
  }

  return (
    <div>
      <Navbar />
      <PageTransition>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                {user?.isSuperAdmin ? "Toutes les écoles" : "Mes écoles"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {user?.isSuperAdmin
                  ? "En tant que superadmin, vous avez accès à toutes les écoles enregistrées."
                  : "Créez et gérez autant d'écoles que vous le souhaitez."}
              </p>
            </div>
            <Button onClick={() => setShowForm((v) => !v)}>
              + Nouvelle école
            </Button>
          </div>

          {showForm && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <Formik
                  initialValues={initialValues}
                  validationSchema={CreateSchoolSchema}
                  onSubmit={handleCreate}
                >
                  {({ isSubmitting }) => (
                    <Form className="flex items-start gap-3" noValidate>
                      <TextInputField
                        name="name"
                        label="Nom de l'école"
                        placeholder="ex : Collège Saint-Michel"
                        wrapperClassName="flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-6"
                      >
                        {isSubmitting ? "Création…" : "Créer"}
                      </Button>
                    </Form>
                  )}
                </Formik>
              </CardContent>
            </Card>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Input
              placeholder="Rechercher une école…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
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
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {schoolsQuery.isLoading ? (
            <p className="text-muted-foreground">Chargement…</p>
          ) : filteredSchools.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              {schools.length === 0
                ? "Aucune école pour l'instant. Créez-en une pour commencer."
                : "Aucune école ne correspond à ces filtres."}
            </p>
          ) : (
            <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSchools.map((school) => (
                <StaggerItem key={school.id}>
                  <Link to={`/schools/${school.id}`}>
                    <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                      <CardHeader>
                        <CardTitle className="text-base">
                          {school.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {school.currentSchoolYear?.label ||
                            "Année scolaire non définie"}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{school._count?.students ?? 0} élève(s)</span>
                          <span>·</span>
                          <span>
                            {school._count?.memberships ?? 0} membre(s)
                          </span>
                        </div>
                        {school.myRoles && school.myRoles.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {school.myRoles.map((role) => (
                              <Badge key={role} variant="secondary">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
