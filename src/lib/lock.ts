/**
 * قفل التطبيق برقم سرّي (§7 · الأمر ٩).
 * تجزئة SHA-256 — لا يُخزَّن الرقم صريحاً. الفتح لكل جلسة عبر sessionStorage.
 * محلي بالكامل — لا شيء يغادر الجهاز.
 */
import { db } from "@/db";

const SESSION_KEY = "abla-unlocked";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** يعيّن رقماً سرّياً (٤–٦ خانات). يعيد false إن كان غير صالح. */
export async function setPin(pin: string): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  await db.settings.update(1, { passwordHash: await sha256Hex(pin), updatedAt: Date.now() });
  markUnlocked();
  return true;
}

export async function removePin(): Promise<void> {
  await db.settings.update(1, { passwordHash: undefined, updatedAt: Date.now() });
  markUnlocked();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const hash = (await db.settings.get(1))?.passwordHash;
  if (!hash) return true;
  return (await sha256Hex(pin)) === hash;
}

export async function isLockEnabled(): Promise<boolean> {
  return Boolean((await db.settings.get(1))?.passwordHash);
}

export function markUnlocked(): void {
  sessionStorage.setItem(SESSION_KEY, "1");
}

export function isUnlockedThisSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}
