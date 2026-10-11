import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import PageLoader from "./components/PageLoader";
import PublicLayout from "./layouts/public/PublicLayout";
import SchoolLayout from "./layouts/school/SchoolLayout";


const LandingPage = lazy(() => import("./pages/LandingPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

const PublicResourcesPage = lazy(() => import("./pages/PublicResourcesPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const AccountPage = lazy(() => import("./pages/auth/AccountPage"));
const SchoolsDashboardPage = lazy(() => import("./pages/school/SchoolsDashboardPage"));

const PublicContentPage = lazy(() => import("./pages/admin/PublicContentPage"));

const GlobalStatsPage = lazy(() => import("./pages/admin/GlobalStatsPage"));
const SchoolOverviewPage = lazy(() => import("./pages/school/SchoolOverviewPage"));
const SchoolSettingsPage = lazy(() => import("./pages/school/SchoolSettingsPage"));
const SchoolMembersPage = lazy(() => import("./pages/school/SchoolMembersPage"));
const StudentsPage = lazy(() => import("./pages/school/StudentsPage"));
const SubjectsPage = lazy(() => import("./pages/school/SubjectsPage"));
const EnrollmentsPage = lazy(() => import("./pages/school/EnrollmentsPage"));

const TuitionPage = lazy(() => import("./pages/school/TuitionPage"));
const PaymentTrackingPage = lazy(() => import("./pages/school/PaymentTrackingPage"));
const GradesPage = lazy(() => import("./pages/school/GradesPage"));

const EndOfYearPage = lazy(() => import("./pages/school/EndOfYearPage"));
const AttendancePage = lazy(() => import("./pages/school/AttendancePage"));
const PersonnelPage = lazy(() => import("./pages/school/PersonnelPage"));
const TimetablePage = lazy(() => import("./pages/school/TimetablePage"));

const StructurePage = lazy(() => import("./pages/school/StructurePage"));
const AnalyticsPage = lazy(() => import("./pages/school/AnalyticsPage"));
const FinancesPage = lazy(() => import("./pages/school/FinancesPage"));

const ParentPortalPage = lazy(() => import("./pages/school/ParentPortalPage"));

const StudentPortalPage = lazy(() => import("./pages/school/StudentPortalPage"));

const MessagesPage = lazy(() => import("./pages/school/MessagesPage"));

const StudentNetworkPage = lazy(() => import("./pages/school/StudentNetworkPage"));

const ResourcesPage = lazy(() => import("./pages/school/ResourcesPage"));

export default function App() {
  return (

    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/ressources" element={<PublicResourcesPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/schools" element={<SchoolsDashboardPage />} />
            <Route path="/admin/content" element={<PublicContentPage />} />
            <Route path="/admin/stats" element={<GlobalStatsPage />} />
            <Route path="/schools/:schoolId" element={<SchoolLayout />}>
              <Route index element={<SchoolOverviewPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="subjects" element={<SubjectsPage />} />
              <Route path="enrollments" element={<EnrollmentsPage />} />
              <Route path="tuition-fees" element={<TuitionPage />} />
              <Route path="payment-tracking" element={<PaymentTrackingPage />} />
              <Route path="grades" element={<GradesPage />} />
              <Route path="end-of-year" element={<EndOfYearPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="personnel" element={<PersonnelPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="finances" element={<FinancesPage />} />
              <Route path="structure" element={<StructurePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SchoolSettingsPage />} />
              <Route path="members" element={<SchoolMembersPage />} />
              <Route path="parent" element={<ParentPortalPage />} />
              <Route path="student" element={<StudentPortalPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="student-network" element={<StudentNetworkPage />} />
              <Route path="resources" element={<ResourcesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
