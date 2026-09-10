/**
 * قشرة التطبيق — تقسيم حديث:
 * شاشات واسعة: شريط جانبي (هوية + تنقّل) + عمود محتوى رحب.
 * موبايل: ترويسة هوية خفيفة + شريط سفلي.
 */
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import ToastViewport from "@/components/Toast";
import WelcomeTour from "@/components/WelcomeTour";

export default function RootLayout() {
  const { pathname } = useLocation();
  return (
    <div className="app-canvas min-h-dvh md:flex md:gap-0 md:p-3 md:pe-3">
      <Sidebar />
      {/* اللوح العاجي العائم — ورقة المحتوى فوق القماش المائي */}
      <div className="app-sheet min-w-0 flex-1 md:ms-3">
        <TopBar />
        {/* pb-32 موبايل: مساحة الشريط السفلي الثابت */}
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 md:px-8 md:pb-14">
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      <ToastViewport />
      <WelcomeTour />
    </div>
  );
}
