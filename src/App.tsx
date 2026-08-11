/**
 * التوجيه — HashRouter لأنه يعمل بلا خادم إعادة توجيه:
 * مضمون في العمل دون إنترنت وفي التغليف لاحقاً (Tauri/PWA).
 */
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import HomePage from "@/pages/HomePage";
import SettingsPage from "@/pages/SettingsPage";

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
