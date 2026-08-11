/**
 * التوجيه — HashRouter لأنه يعمل بلا خادم إعادة توجيه:
 * مضمون في العمل دون إنترنت وفي التغليف لاحقاً (Tauri/PWA).
 *
 * عمق التنقل (§6): الرئيسية ← الفصول ← طالبات الفصل ← ملف الطالبة = ٣ نقرات.
 */
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
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
import DevOcrPage from "@/pages/DevOcrPage";
import SettingsPage from "@/pages/SettingsPage";
import PolicyPage from "@/pages/PolicyPage";

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
      { path: "/dev/ocr", element: <DevOcrPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/settings/policy", element: <PolicyPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
