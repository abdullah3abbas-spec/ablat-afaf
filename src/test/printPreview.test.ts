/**
 * نافذة المعاينة قبل الطباعة (§6): كل أمر «اطبعي» يفتح معاينة أولاً —
 * لا حوار طباعة مفاجئاً. نختبر أن النافذة تُبنى وتُغلق وتحمل العنوان.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { printHtml } from "@/lib/sheetPrint";

const SAMPLE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>ورقة عمل: تجربة المعاينة</title></head><body><p>محتوى</p></body></html>`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("printHtml — معاينة قبل الطباعة", () => {
  it("يفتح نافذة معاينة بعنوان المستند وزرّي طباعة وإغلاق", () => {
    printHtml(SAMPLE);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute("aria-label")).toContain("ورقة عمل: تجربة المعاينة");
    const frame = dialog!.querySelector("iframe");
    expect(frame?.getAttribute("srcdoc")).toContain("تجربة المعاينة");
    const buttons = [...dialog!.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons.join(" ")).toContain("اطبعي");
    expect(buttons.join(" ")).toContain("أغلقي");
  });

  it("زر الإغلاق يزيل النافذة", () => {
    printHtml(SAMPLE);
    const close = [...document.querySelectorAll("button")].find((b) => b.textContent === "أغلقي")!;
    close.click();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("Esc يغلق النافذة", () => {
    printHtml(SAMPLE);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("فتح معاينة جديدة يغلق السابقة — نافذة واحدة دائماً", () => {
    printHtml(SAMPLE);
    printHtml(SAMPLE.replace("تجربة المعاينة", "مستند ثانٍ"));
    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs.length).toBe(1);
    expect(dialogs[0].getAttribute("aria-label")).toContain("مستند ثانٍ");
  });
});
