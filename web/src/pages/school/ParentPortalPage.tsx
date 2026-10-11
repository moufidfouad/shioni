import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Users } from "lucide-react";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import {
  useChildSummaryQuery,
  useMyChildrenQuery,
} from "@/features/parent-portal/api";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StudentSummaryPanel from "@/components/StudentSummaryPanel";
import PageTransition from "@/components/motion/PageTransition";

export default function ParentPortalPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const childrenQuery = useMyChildrenQuery(school.id);
  const parametersQuery = useSchoolParametersQuery(school.id);
  const children = childrenQuery.data ?? [];

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [trimestre, setTrimestre] = useState(1);

  useEffect(() => {
    if (!selectedStudentId && children.length > 0)
      setSelectedStudentId(children[0].id);
  }, [children, selectedStudentId]);

  const summaryQuery = useChildSummaryQuery(
    school.id,
    selectedStudentId,
    trimestre,
  );
  const summary = summaryQuery.data;

  const trimestreOptions = useMemo(
    () =>
      Array.from(
        { length: parametersQuery.data?.nbTrimestres ?? 3 },
        (_, i) => i + 1,
      ),
    [parametersQuery.data?.nbTrimestres],
  );

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Mes enfants" description={school.name} />

      {childrenQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun enfant lié à votre compte"
          description="Si vous pensez que c'est une erreur, contactez le secrétariat de l'école."
        />
      ) : (
        <>
          {children.length > 1 && (
            <Select
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Choisir un enfant" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {summaryQuery.isLoading || !summary ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <StudentSummaryPanel
              summary={summary}
              currency={school.currency}
              trimestre={trimestre}
              trimestreOptions={trimestreOptions}
              onTrimestreChange={setTrimestre}
            />
          )}
        </>
      )}
    </PageTransition>
  );
}
