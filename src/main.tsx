/**
 * نقطة الإقلاع: زرع البيانات إن كانت القاعدة فارغة، ثم ترطيب
 * إعدادات العرض من قاعدة البيانات، ثم تركيب التطبيق.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { seedIfEmpty } from "@/db";
import { useUi } from "@/store/ui";
import "./index.css";

async function boot(): Promise<void> {
  await seedIfEmpty();
  await useUi.getState().hydrateFromDb();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void boot();
