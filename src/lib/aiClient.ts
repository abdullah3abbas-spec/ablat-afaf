/**
 * عميل بوابة الذكاء الاصطناعي (زكريت م٢).
 *
 * الخط الفاصل (§2-هـ): لا يستدعى هذا الملف إلا بمحتوى منهجي مرّ على
 * شاشة «ما سيُرسل» وحارس الأسماء. المفاتيح ليست هنا — على الخادم فقط،
 * والتطبيق يحمل «رمز ربط» تدخله المعلّمة مرة واحدة في الإعدادات.
 */
import { db } from "@/db";

/**
 * رابط البوابة الافتراضي — عبر دومين الموقع نفسه (بروكسي Pages Functions):
 * بعض الشبكات تحجب workers.dev، ونفس الأصل يعمل حيثما عمل الموقع وبلا CORS.
 */
export const DEFAULT_GATEWAY_URL = "https://ablat-afaf.pages.dev";

/** الرابط المباشر القديم — يُرحَّل عنه تلقائياً في v12 */
export const LEGACY_GATEWAY_URL = "https://afaf-ai-gateway.abdullah3abbas.workers.dev";

export interface AskSource {
  name: string;
  text: string;
  locator?: string;
}

export interface AskResult {
  answer: string;
  provider: "gemini" | "openai";
  model: string;
  costUsd: number;
  alert: 0 | 60 | 80 | 95 | 100;
  cached: boolean;
}

export interface ProviderUsage {
  configured: boolean;
  totalUsd: number;
  todayUsd: number;
  budgetUsd: number;
  dailyCapUsd: number;
  alert: 0 | 60 | 80 | 95 | 100;
  exhausted: boolean;
}

export interface GatewayHealth {
  ok: boolean;
  providers: { gemini: ProviderUsage; openai: ProviderUsage };
}

export type AiErrorKind =
  | "off" // الاتصال مقطوع من الإعدادات
  | "no_token" // رمز الربط غير مُدخل
  | "unauthorized" // رمز الربط خطأ
  | "no_providers" // المفاتيح لم تُضبط على الخادم
  | "budget" // الميزانية أو الحد اليومي استُنفد
  | "rate" // طلبات كثيرة
  | "network" // تعذّر الوصول
  | "failed"; // فشل المزوّدين

export class AiClientError extends Error {
  constructor(
    public kind: AiErrorKind,
    public messageAr: string
  ) {
    super(messageAr);
  }
}

interface GatewayConfig {
  url: string;
  token: string;
  enabled: boolean;
}

export async function gatewayConfig(): Promise<GatewayConfig> {
  const s = await db.settings.get(1);
  return {
    url: (s?.aiGatewayUrl?.trim() || DEFAULT_GATEWAY_URL).replace(/\/+$/, ""),
    token: s?.aiGatewayToken?.trim() ?? "",
    enabled: s?.aiConnectionEnabled ?? false,
  };
}

async function gatewayFetch(path: string, init?: RequestInit): Promise<Response> {
  const cfg = await gatewayConfig();
  if (!cfg.enabled) throw new AiClientError("off", "الاتصال بمساعدة الذكاء مقطوع — فعّليه من الإعدادات أولاً");
  // لا رمز مطلوب من المعلّمة: البروكسي على دومين الموقع يحقن الرمز من سرّ
  // الخادم. الإدخال اليدوي في الإعدادات يتقدّم إن وُجد (تدوير/طوارئ فقط).
  let res: Response;
  try {
    res = await fetch(cfg.url + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(cfg.token ? { "x-afaf-token": cfg.token } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new AiClientError("network", "تعذّر الوصول للبوابة — تأكدي من الإنترنت ثم أعيدي المحاولة");
  }
  if (res.ok) return res;

  const body = (await res.json().catch(() => ({}))) as { error?: string; messageAr?: string };
  const msg = body.messageAr;
  if (res.status === 401) throw new AiClientError("unauthorized", msg ?? "رمز الربط غير صحيح — راجعي الإعدادات");
  if (body.error === "no_providers") throw new AiClientError("no_providers", msg ?? "مفاتيح المزوّدين لم تُضبط بعد");
  if (body.error === "budget_exhausted") throw new AiClientError("budget", msg ?? "وصلتِ حدّ الميزانية");
  if (res.status === 429) throw new AiClientError("rate", msg ?? "طلبات كثيرة متتالية — انتظري دقيقة");
  throw new AiClientError("failed", msg ?? "تعذّر تنفيذ الطلب الآن — حاولي بعد قليل");
}

/** فحص الاتصال والمفاتيح والميزانية — لا يكلّف شيئاً (لا نداء مزوّد) */
export async function fetchHealth(): Promise<GatewayHealth> {
  const res = await gatewayFetch("/api/health");
  return (await res.json()) as GatewayHealth;
}

/**
 * «اسألي المنهج»: سؤال + مصادر منهجية → إجابة موثّقة بالمصدر.
 * يُستدعى حصراً بعد موافقة شاشة «ما سيُرسل».
 */
export async function askCurriculum(
  question: string,
  sources: AskSource[],
  mode: "brief" | "detailed" = "brief"
): Promise<AskResult> {
  const res = await gatewayFetch("/api/ask", {
    method: "POST",
    body: JSON.stringify({ question, sources, mode }),
  });
  return (await res.json()) as AskResult;
}

export interface SlidesResult {
  slides: import("@/db/schema").VisualSlide[];
  provider: "gemini" | "openai";
  model: string;
  costUsd: number;
  alert: 0 | 60 | 80 | 95 | 100;
  cached: boolean;
}

/**
 * توليد عرض بصري كامل من المصادر (زكريت م٣).
 * يُستدعى حصراً بعد موافقة شاشة «ما سيُرسل» — والناتج مسودة حتى الاعتماد.
 */
export async function generateSlides(lessonTitle: string, sources: AskSource[]): Promise<SlidesResult> {
  const res = await gatewayFetch("/api/generate-slides", {
    method: "POST",
    body: JSON.stringify({ lessonTitle, sources }),
  });
  return (await res.json()) as SlidesResult;
}

export interface ImageResult {
  dataUrl: string;
  provider: "openai";
  model: string;
  costUsd: number;
  alert: 0 | 60 | 80 | 95 | 100;
  cached: boolean;
}

/**
 * توليد صورة تعليمية من وصف مشتق من محتوى الوزارة (استوديو المخرجات).
 * يُستدعى حصراً بعد موافقة شاشة «ما سيُرسل» على قائمة الأوصاف.
 */
export async function generateImage(prompt: string): Promise<ImageResult> {
  const res = await gatewayFetch("/api/generate-image", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
  return (await res.json()) as ImageResult;
}

export interface LessonPackResult {
  pack: import("@/db/schema").LessonPackContent;
  provider: "gemini" | "openai";
  model: string;
  costUsd: number;
  alert: 0 | 60 | 80 | 95 | 100;
  cached: boolean;
}

/**
 * توليد حزمة الحصة الكاملة لأي درس (١٥/١٠).
 * يُستدعى حصراً بعد موافقة شاشة «ما سيُرسل» — والناتج مسودة حتى الاعتماد.
 */
export async function generateLessonPack(lessonTitle: string, sources: AskSource[]): Promise<LessonPackResult> {
  const res = await gatewayFetch("/api/generate-lesson-pack", {
    method: "POST",
    body: JSON.stringify({ lessonTitle, sources }),
  });
  return (await res.json()) as LessonPackResult;
}
