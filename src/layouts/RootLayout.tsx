/**
 * قشرة التطبيق — تقسيم حديث:
 * شاشات واسعة: شريط جانبي (هوية + تنقّل) + عمود محتوى رحب.
 * موبايل: ترويسة هوية خفيفة + شريط سفلي.
 */
import { Outlet } from "react-router-dom";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import ToastViewport from "@/components/Toast";

export default function RootLayout() {
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        {/* pb-32 موبايل: مساحة الشريط السفلي الثابت */}
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 md:px-8 md:pb-14">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <ToastViewport />
    </div>
  );
}
