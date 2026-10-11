import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import { useMyStudentSummaryQuery } from "@/features/student-portal/api";
import { useSchoolParametersQuery } from "@/features/parameters/api";
import PageHeader from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import StudentSummaryPanel from "@/components/StudentSummaryPanel";
import PageTransition from "@/components/motion/PageTransition";


export default function StudentPortalPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const parametersQuery = useSchoolParametersQuery(school.id);

  const [trimestre, setTrimestre] = useState(1);

  const summaryQuery = useMyStudentSummaryQuery(school.id, trimestre);
  const summary = summaryQuery.data;

  const trimestreOptions = useMemo(
    () => Array.from({ length: parametersQuery.data?.nbTrimestres ?? 3 }, (_, i) => i + 1),
    [parametersQuery.data?.nbTrimestres]
  );

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Mes résultats" description={school.name} />

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
    </PageTransition>
  );
}
