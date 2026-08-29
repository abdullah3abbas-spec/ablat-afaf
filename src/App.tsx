/**
 * التوجيه — HashRouter لأنه يعمل بلا خادم إعادة توجيه:
 * مضمون في العمل دون إنترنت وفي التغليف لاحقاً (Tauri/PWA).
 *
 * عمق التنقل (§6): الرئيسية ← الفصول ← طالبات الفصل ← ملف الطالبة = ٣ نقرات.
 */
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import LockGate from "@/components/LockGate";
import RootLayout from "@/layouts/RootLayout";
import TodayPage from "@/pages/TodayPage";
import LibraryPage from "@/pages/LibraryPage";
import LessonKitPage from "@/pages/LessonKitPage";
import ClassesPage from "@/pages/ClassesPage";
import ClassStudentsPage from "@/pages/ClassStudentsPage";
import StudentPage from "@/pages/StudentPage";
import ResourcesPage from "@/pages/ResourcesPage";
import StudioPage from "@/pages/StudioPage";
import GradesPage from "@/pages/GradesPage";
import AttendancePage from "@/pages/AttendancePage";
import PointsPage from "@/pages/PointsPage";
import BoardPage from "@/pages/BoardPage";
import QuestionsPage from "@/pages/QuestionsPage";
import CertificatesPage from "@/pages/CertificatesPage";
import WorksheetsPage from "@/pages/WorksheetsPage";
import ReportsPage from "@/pages/ReportsPage";
import CurriculumPage from "@/pages/CurriculumPage";
import SearchPage from "@/pages/SearchPage";
import TeachPage from "@/pages/TeachPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import RequestsPage from "@/pages/RequestsPage";
import ExamsPage from "@/pages/ExamsPage";
import ExamWizardPage from "@/pages/ExamWizardPage";
import ExamResultsPage from "@/pages/ExamResultsPage";
import DevOcrPage from "@/pages/DevOcrPage";
import SettingsPage from "@/pages/SettingsPage";
import PolicyPage from "@/pages/PolicyPage";
import PrepPage from "@/pages/PrepPage";
import FollowPage from "@/pages/FollowPage";
import AskPage from "@/pages/AskPage";
import ClassModePage from "@/pages/ClassModePage";
import SlidesStudioPage from "@/pages/SlidesStudioPage";
import SlidesPresentPage from "@/pages/SlidesPresentPage";
import LessonShowPage from "@/pages/LessonShowPage";
import SetupPage from "@/pages/SetupPage";
import LabPage from "@/pages/LabPage";
import LessonPackPage from "@/pages/LessonPackPage";

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <TodayPage /> },
      { path: "/library", element: <LibraryPage /> },
      { path: "/library/:lessonId", element: <LessonKitPage /> },
      { path: "/classes", element: <ClassesPage /> },
      { path: "/classes/:classId", element: <ClassStudentsPage /> },
      { path: "/students/:studentId", element: <StudentPage /> },
      { path: "/resources", element: <ResourcesPage /> },
      { path: "/studio/:resourceId", element: <StudioPage /> },
      { path: "/grades", element: <GradesPage /> },
      { path: "/attendance", element: <AttendancePage /> },
      { path: "/points", element: <PointsPage /> },
      { path: "/points/board", element: <BoardPage /> },
      { path: "/questions", element: <QuestionsPage /> },
      { path: "/exams", element: <ExamsPage /> },
      { path: "/exams/new", element: <ExamWizardPage /> },
      { path: "/exams/:examId/build", element: <ExamWizardPage /> },
      { path: "/exams/:examId/results", element: <ExamResultsPage /> },
      { path: "/certificates", element: <CertificatesPage /> },
      { path: "/worksheets", element: <WorksheetsPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/curriculum", element: <CurriculumPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/teach", element: <TeachPage /> },
      { path: "/tools", element: <TeachPage /> },
      { path: "/analytics", element: <AnalyticsPage /> },
      { path: "/requests", element: <RequestsPage /> },
      { path: "/prep", element: <PrepPage /> },
      { path: "/follow", element: <FollowPage /> },
      { path: "/manage", element: <FollowPage /> },
      { path: "/ask", element: <AskPage /> },
      { path: "/slides", element: <SlidesStudioPage /> },
      { path: "/pack", element: <LessonPackPage /> },
      { path: "/dev/ocr", element: <DevOcrPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/settings/policy", element: <PolicyPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
  // وضع الفصل: شاشة بروجكتور كاملة خارج التخطيط العام (بلا شريطين)
  { path: "/class", element: <ClassModePage /> },
  // عرض البروجكتور للعرض البصري المعتمد (زكريت م٣)
  { path: "/slides/:presentationId/present", element: <SlidesPresentPage /> },
  // «العرض المساعد» — برزنتيشن الحصة الكامل الفوري لأي درس من الكتاب
  { path: "/show", element: <LessonShowPage /> },
  // رابط الإعداد السحري — توصيل الذكاء بضغطة واحدة (يُرسل للمعلّمة مرة)
  { path: "/setup", element: <SetupPage /> },
  // المختبر التفاعلي — شاشة كاملة داكنة (زكريت م٤-ب)
  { path: "/lab", element: <LabPage /> },
]);

export default function App() {
  return (
    <LockGate>
      <RouterProvider router={router} />
    </LockGate>
  );
}
