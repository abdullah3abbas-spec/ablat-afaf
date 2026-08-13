import { Outlet } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import ToastViewport from "@/components/Toast";

export default function RootLayout() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      {/* pb-32: مساحة لشريط التنقّل السفلي الثابت كي لا يغطي آخر المحتوى */}
      <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
        <Outlet />
      </main>
      <BottomNav />
      <ToastViewport />
    </div>
  );
}
