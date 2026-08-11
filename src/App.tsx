/**
 * التوجيه — HashRouter لأنه يعمل بلا خادم إعادة توجيه:
 * مضمون في العمل دون إنترنت وفي التغليف لاحقاً (Tauri/PWA).
 *
 * عمق التنقل (§6): الرئيسية ← الفصول ← طالبات الفصل ← ملف الطالبة = ٣ نقرات.
 */
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import HomePage from "@/pages/HomePage";
import ClassesPage from "@/pages/ClassesPage";
import ClassStudentsPage from "@/pages/ClassStudentsPage";
import StudentPage from "@/pages/StudentPage";
import SettingsPage from "@/pages/SettingsPage";

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/classes", element: <ClassesPage /> },
      { path: "/classes/:classId", element: <ClassStudentsPage /> },
      { path: "/students/:studentId", element: <StudentPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
