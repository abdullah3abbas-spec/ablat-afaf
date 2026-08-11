import { Outlet } from "react-router-dom";
import TopBar from "@/components/TopBar";
import ToastViewport from "@/components/Toast";

export default function RootLayout() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <ToastViewport />
    </div>
  );
}
