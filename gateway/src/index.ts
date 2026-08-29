/**
 * بوابة الذكاء الاصطناعي لمنصّة أبلة عفاف — Cloudflare Worker.
 *
 * الخط الفاصل (§2-هـ من دستور المشروع): هذه البوابة تستقبل محتوى المنهج
 * فقط. أسماء الطالبات لا تصل إلى هنا أصلاً — حارس الأسماء في التطبيق
 * يمنع خروجها من الجهاز، وشاشة «ما سيُرسل» تعرض كل حمولة قبل إرسالها.
 *
 * المفاتيح أسرار على الخادم (wrangler secret) — لا تظهر في الواجهة أبداً.
 * الميزانية: عدّادات KV لكل مزوّد (إجمالي + يومي) مع حدود قاطعة وتنبيهات
 * 60/80/95% (Budget Guardian) وكاش للنواتج المتطابقة.
 */
import {
  GEN_LIMITS,
  LIMITS,
  packSystemPrompt,
  packUserPrompt,
  supervisorPackPrompt,
  supervisorSlidesPrompt,
  validateLessonPack,
  SLIDES_OPENAI_SCHEMA,
  alertLevel,
  cacheKeyOf,
  dohaDayKey,
  estimateCostUsd,
  pickProviders,
  slidesSystemPrompt,
  slidesUserPrompt,
  systemPrompt,
  userPrompt,
  validateAsk,
  validateSlidesPayload,
  type AskSource,
  type Provider,
} from "./logic";
import { ProviderError, callGemini, callGeminiJson, callOpenAI, callOpenAIJson, type CallResult , callOpenAIImage } from "./providers";

interface Env {
  USAGE: KVNamespace;
  GATEWAY_TOKEN?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ALLOWED_ORIGINS: string;
  /** مرحلة المشرفة على مخرجات التوليد (افتراضياً مفعّلة) */
  SUPERVISOR_ENABLED?: string;
  OPENAI_IMAGE_MODEL?: string;
  IMAGE_QUALITY?: string;
  IMAGE_USD_EACH?: string;
  /** جهد تفكير نماذج gpt-5 — بدونها قد يعود الرد فارغاً */
  OPENAI_REASONING_EFFORT?: string;
  GEMINI_MODEL: string;
  OPENAI_MODEL: string;
  TOTAL_BUDGET_USD: string;
  DAILY_CAP_USD: string;
  GEMINI_IN_PER_M: string;
  GEMINI_OUT_PER_M: string;
  OPENAI_IN_PER_M: string;
  OPENAI_OUT_PER_M: string;
  CACHE_TTL_SECONDS: string;
  RATE_PER_MINUTE: string;
}

/** عنوانا العدّاد في KV لمزوّد ما */
const totalKey = (p: Provider) => `u:${p}:total`;
const dayKey = (p: Provider, day: string) => `u:${p}:d:${day}`;

async function readUsd(kv: KVNamespace, key: string): Promise<number> {
  const v = await kv.get(key);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

interface ProviderUsage {
  configured: boolean;
  totalUsd: number;
  todayUsd: number;
  budgetUsd: number;
  dailyCapUsd: number;
  alert: 0 | 60 | 80 | 95 | 100;
  exhausted: boolean;
}

async function usageOf(env: Env, p: Provider, nowMs: number): Promise<ProviderUsage> {
  const budgetUsd = Number(env.TOTAL_BUDGET_USD) || 50;
  const dailyCapUsd = Number(env.DAILY_CAP_USD) || 5;
  const totalUsd = await readUsd(env.USAGE, totalKey(p));
  const todayUsd = await readUsd(env.USAGE, dayKey(p, dohaDayKey(nowMs)));
  return {
    configured: p === "gemini" ? Boolean(env.GEMINI_API_KEY) : Boolean(env.OPENAI_API_KEY),
    totalUsd,
    todayUsd,
    budgetUsd,
    dailyCapUsd,
    alert: alertLevel(totalUsd, budgetUsd),
    exhausted: totalUsd >= budgetUsd || todayUsd >= dailyCapUsd,
  };
}

/** تسجيل التكلفة بعد النداء — كتابتان في KV (دقة كافية لمستخدمة واحدة) */
async function addSpend(env: Env, p: Provider, usd: number, nowMs: number): Promise<void> {
  const t = totalKey(p);
  const d = dayKey(p, dohaDayKey(nowMs));
  await env.USAGE.put(t, String((await readUsd(env.USAGE, t)) + usd));
  // العدّاد اليومي يبقى شهرين ثم يتنظف وحده
  await env.USAGE.put(d, String((await readUsd(env.USAGE, d)) + usd), { expirationTtl: 60 * 86400 });
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  if (origin && allowed.includes(origin)) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-afaf-token",
      "access-control-max-age": "86400",
    };
  }
  return {};
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404, cors);

    // متصفح من أصل غير مسموح؟ لا CORS — نرفض مبكراً بوضوح
    if (origin && !cors["access-control-allow-origin"]) {
      return json({ error: "origin_not_allowed" }, 403, {});
    }

    // المصادقة: رمز الربط المشترك (سرّ على الخادم، تدخله المعلّمة مرة في الإعدادات)
    if (!env.GATEWAY_TOKEN || request.headers.get("x-afaf-token") !== env.GATEWAY_TOKEN) {
      return json({ error: "unauthorized", messageAr: "رمز الربط غير صحيح — راجعي الإعدادات" }, 401, cors);
    }

    // حدّ معدّل بسيط لكل دقيقة (حماية من العبث لا أكثر)
    const minute = Math.floor(Date.now() / 60000);
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const rateKey = `r:${ip}:${minute}`;
    const count = Number((await env.USAGE.get(rateKey)) ?? "0") + 1;
    ctx.waitUntil(env.USAGE.put(rateKey, String(count), { expirationTtl: 120 }));
    if (count > (Number(env.RATE_PER_MINUTE) || 20)) {
      return json({ error: "rate_limited", messageAr: "طلبات كثيرة متتالية — انتظري دقيقة" }, 429, cors);
    }

    const nowMs = Date.now();

    if (request.method === "GET" && url.pathname === "/api/health") {
      const [gemini, openai] = await Promise.all([usageOf(env, "gemini", nowMs), usageOf(env, "openai", nowMs)]);
      return json({ ok: true, providers: { gemini, openai } }, 200, cors);
    }

    if (request.method === "GET" && url.pathname === "/api/usage") {
      const [gemini, openai] = await Promise.all([usageOf(env, "gemini", nowMs), usageOf(env, "openai", nowMs)]);
      return json({ gemini, openai }, 200, cors);
    }

    // النماذج المتاحة فعلاً لمفتاح Gemini — لتدوير النموذج عند تقادمه
    // (النماذج تتغير كل فترة؛ الاسم إعداد في wrangler.jsonc لا كود)
    if (request.method === "GET" && url.pathname === "/api/models") {
      if (!env.GEMINI_API_KEY) return json({ error: "no_key" }, 503, cors);
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
        headers: { "x-goog-api-key": env.GEMINI_API_KEY },
      });
      if (!res.ok) return json({ error: "list_failed", detail: (await res.text()).slice(0, 300) }, 502, cors);
      const data = (await res.json()) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
      };
      const models = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => (m.name ?? "").replace(/^models\//, ""));
      return json({ current: env.GEMINI_MODEL, models }, 200, cors);
    }

    if (request.method === "POST" && url.pathname === "/api/ask") {
      let body: { question?: string; sources?: AskSource[]; mode?: "brief" | "detailed" };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "bad_json", messageAr: "طلب غير مقروء" }, 400, cors);
      }

      const invalid = validateAsk(body.question, body.sources);
      if (invalid) return json({ error: "invalid", messageAr: invalid }, 400, cors);
      const question = body.question as string;
      const sources = body.sources as AskSource[];
      const mode = body.mode === "detailed" ? "detailed" : "brief";

      // كاش النواتج المتطابقة — سؤال ومصادر متطابقة لا يُدفع ثمنها مرتين
      const key = "c:" + (await cacheKeyOf({ question, sources, mode }));
      const cached = await env.USAGE.get(key);
      if (cached) {
        return json({ ...(JSON.parse(cached) as object), cached: true }, 200, cors);
      }

      const [gemini, openai] = await Promise.all([usageOf(env, "gemini", nowMs), usageOf(env, "openai", nowMs)]);
      const order = pickProviders({
        geminiReady: gemini.configured,
        openaiReady: openai.configured,
        geminiExhausted: gemini.exhausted,
        openaiExhausted: openai.exhausted,
      });

      if (order.length === 0) {
        const anyConfigured = gemini.configured || openai.configured;
        return json(
          {
            error: anyConfigured ? "budget_exhausted" : "no_providers",
            messageAr: anyConfigured
              ? "وصلتِ حدّ الميزانية (اليومي أو الإجمالي) — يرتفع الحد من إعدادات البوابة"
              : "لم تُضبط مفاتيح المزوّدين بعد — هذه خطوة ابنك",
          },
          anyConfigured ? 429 : 503,
          cors
        );
      }

      const sys = systemPrompt(mode);
      const usr = userPrompt(question, sources);
      let lastError = "";

      for (const p of order) {
        try {
          const result: CallResult =
            p === "gemini"
              ? await callGemini(env.GEMINI_API_KEY as string, env.GEMINI_MODEL, sys, usr, LIMITS.answerMaxTokens)
              : await callOpenAI(env.OPENAI_API_KEY as string, env.OPENAI_MODEL, sys, usr, LIMITS.answerMaxTokens, env.OPENAI_REASONING_EFFORT || "low");

          const prices =
            p === "gemini"
              ? { inPerM: Number(env.GEMINI_IN_PER_M) || 0, outPerM: Number(env.GEMINI_OUT_PER_M) || 0 }
              : { inPerM: Number(env.OPENAI_IN_PER_M) || 0, outPerM: Number(env.OPENAI_OUT_PER_M) || 0 };
          const costUsd = estimateCostUsd(result.inTokens, result.outTokens, prices);
          ctx.waitUntil(addSpend(env, p, costUsd, nowMs));

          const usage = p === "gemini" ? gemini : openai;
          const payload = {
            answer: result.text,
            provider: p,
            model: p === "gemini" ? env.GEMINI_MODEL : env.OPENAI_MODEL,
            costUsd,
            alert: alertLevel(usage.totalUsd + costUsd, usage.budgetUsd),
            cached: false,
          };
          ctx.waitUntil(
            env.USAGE.put(key, JSON.stringify(payload), {
              expirationTtl: Number(env.CACHE_TTL_SECONDS) || 604800,
            })
          );
          return json(payload, 200, cors);
        } catch (e) {
          lastError = e instanceof ProviderError ? `${e.provider} ${e.status}: ${e.message}` : String(e);
          // يظهر في wrangler tail — تشخيص فشل مزوّد دون كشفه للمستخدمة
          console.warn("provider_failed", lastError);
        }
      }

      return json(
        { error: "providers_failed", messageAr: "تعذّر الوصول للمزوّدين الآن — حاولي بعد قليل", detail: lastError },
        502,
        cors
      );
    }

    // توليد حزمة الحصة الكاملة لأي درس (١٥/١٠)
    if (request.method === "POST" && url.pathname === "/api/generate-lesson-pack") {
      let body: { lessonTitle?: string; sources?: AskSource[] };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "bad_json", messageAr: "طلب غير مقروء" }, 400, cors);
      }
      if (typeof body.lessonTitle !== "string" || body.lessonTitle.trim() === "") {
        return json({ error: "invalid", messageAr: "اسم الدرس مطلوب" }, 400, cors);
      }
      const invalid = validateAsk(`حزمة: ${body.lessonTitle}`, body.sources);
      if (invalid) return json({ error: "invalid", messageAr: invalid }, 400, cors);
      const lessonTitle = body.lessonTitle.trim();
      const sources = body.sources as AskSource[];

      const key = "c:" + (await cacheKeyOf({ kind: "pack", lessonTitle, sources }));
      const cached = await env.USAGE.get(key);
      if (cached) return json({ ...(JSON.parse(cached) as object), cached: true }, 200, cors);

      const [gemini, openai] = await Promise.all([usageOf(env, "gemini", nowMs), usageOf(env, "openai", nowMs)]);
      const order = pickProviders({
        geminiReady: gemini.configured,
        openaiReady: openai.configured,
        geminiExhausted: gemini.exhausted,
        openaiExhausted: openai.exhausted,
      });
      if (order.length === 0) {
        const anyConfigured = gemini.configured || openai.configured;
        return json(
          {
            error: anyConfigured ? "budget_exhausted" : "no_providers",
            messageAr: anyConfigured
              ? "وصلتِ حدّ الميزانية (اليومي أو الإجمالي) — يرتفع الحد من إعدادات البوابة"
              : "لم تُضبط مفاتيح المزوّدين بعد — هذه خطوة ابنك",
          },
          anyConfigured ? 429 : 503,
          cors
        );
      }

      const sys = packSystemPrompt();
      const usr = packUserPrompt(lessonTitle, sources);
      let lastError = "";

      // «GPT عامل»: في التوليد يتقدم OpenAI ترتيبَ العمل، والمزوّد الآخر مشرفاً
      const workOrder: Provider[] = order.includes("openai")
        ? ["openai", ...order.filter((x) => x !== "openai")]
        : order;

      for (const p of workOrder) {
        try {
          const result: CallResult =
            p === "gemini"
              ? await callGeminiJson(env.GEMINI_API_KEY as string, env.GEMINI_MODEL, sys, usr, GEN_LIMITS.maxAnswerTokens)
              : await callOpenAI(env.OPENAI_API_KEY as string, env.OPENAI_MODEL, sys + "\nأخرجي JSON فقط بلا أي نص آخر.", usr, GEN_LIMITS.maxAnswerTokens, env.OPENAI_REASONING_EFFORT || "low");

          const prices =
            p === "gemini"
              ? { inPerM: Number(env.GEMINI_IN_PER_M) || 0, outPerM: Number(env.GEMINI_OUT_PER_M) || 0 }
              : { inPerM: Number(env.OPENAI_IN_PER_M) || 0, outPerM: Number(env.OPENAI_OUT_PER_M) || 0 };
          const costUsd = estimateCostUsd(result.inTokens, result.outTokens, prices);
          ctx.waitUntil(addSpend(env, p, costUsd, nowMs));

          let parsed: unknown;
          try {
            parsed = JSON.parse(result.text.replace(/^```json\s*/,'').replace(/```\s*$/,''));
          } catch {
            lastError = `${p}: مخرج غير JSON`;
            console.warn("provider_failed", lastError);
            continue;
          }
          const checked = validateLessonPack(parsed);
          if (!checked.ok) {
            lastError = `${p}: ${checked.messageAr}`;
            console.warn("provider_failed", lastError);
            continue;
          }

          // مرحلة المشرفة: مراجعة تعليمية/تصميمية بالمزوّد الآخر — تحسين لا إعادة اختراع
          let finalPack = checked.pack;
          let supCost = 0;
          let supLabel = "";
          const reviewer = (workOrder.find((x) => x !== p) ?? null) as Provider | null;
          if ((env.SUPERVISOR_ENABLED ?? "true") !== "false" && reviewer) {
            try {
              const supUsr = `مسودة العامل (JSON):\n${JSON.stringify(checked.pack)}\n\n${usr}`;
              const r2: CallResult =
                reviewer === "gemini"
                  ? await callGeminiJson(env.GEMINI_API_KEY as string, env.GEMINI_MODEL, supervisorPackPrompt(), supUsr, GEN_LIMITS.maxAnswerTokens)
                  : await callOpenAI(env.OPENAI_API_KEY as string, env.OPENAI_MODEL, supervisorPackPrompt() + "\nأخرجي JSON فقط بلا أي نص آخر.", supUsr, GEN_LIMITS.maxAnswerTokens, env.OPENAI_REASONING_EFFORT || "low");
              const prices2 =
                reviewer === "gemini"
                  ? { inPerM: Number(env.GEMINI_IN_PER_M) || 0, outPerM: Number(env.GEMINI_OUT_PER_M) || 0 }
                  : { inPerM: Number(env.OPENAI_IN_PER_M) || 0, outPerM: Number(env.OPENAI_OUT_PER_M) || 0 };
              supCost = estimateCostUsd(r2.inTokens, r2.outTokens, prices2);
              ctx.waitUntil(addSpend(env, reviewer, supCost, nowMs));
              const parsed2 = JSON.parse(r2.text.replace(/^```json\s*/, "").replace(/```\s*$/, ""));
              const checked2 = validateLessonPack(parsed2);
              if (checked2.ok) {
                finalPack = checked2.pack;
                supLabel = ` ← مراجعة ${reviewer === "gemini" ? env.GEMINI_MODEL : env.OPENAI_MODEL}`;
              }
            } catch (e) {
              console.warn("supervisor_skipped", String(e));
            }
          }

          const usage = p === "gemini" ? gemini : openai;
          const payload = {
            pack: finalPack,
            provider: p,
            model: (p === "gemini" ? env.GEMINI_MODEL : env.OPENAI_MODEL) + supLabel,
            costUsd: Math.round((costUsd + supCost) * 1e6) / 1e6,
            alert: alertLevel(usage.totalUsd + costUsd, usage.budgetUsd),
            cached: false,
          };
          ctx.waitUntil(env.USAGE.put(key, JSON.stringify(payload), { expirationTtl: Number(env.CACHE_TTL_SECONDS) || 604800 }));
          return json(payload, 200, cors);
        } catch (e) {
          lastError = e instanceof ProviderError ? `${e.provider} ${e.status}: ${e.message}` : String(e);
          console.warn("provider_failed", lastError);
        }
      }

      return json(
        { error: "providers_failed", messageAr: "تعذّر توليد الحزمة الآن — حاولي بعد قليل", detail: lastError },
        502,
        cors
      );
    }

    // توليد عرض بصري كامل بمخرج JSON صارم (زكريت م٣)
    if (request.method === "POST" && url.pathname === "/api/generate-slides") {
      let body: { lessonTitle?: string; sources?: AskSource[] };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "bad_json", messageAr: "طلب غير مقروء" }, 400, cors);
      }
      if (typeof body.lessonTitle !== "string" || body.lessonTitle.trim() === "") {
        return json({ error: "invalid", messageAr: "اسم الدرس مطلوب" }, 400, cors);
      }
      const invalid = validateAsk(`عرض: ${body.lessonTitle}`, body.sources);
      if (invalid) return json({ error: "invalid", messageAr: invalid }, 400, cors);
      const lessonTitle = body.lessonTitle.trim();
      const sources = body.sources as AskSource[];

      const key = "c:" + (await cacheKeyOf({ kind: "slides", lessonTitle, sources }));
      const cached = await env.USAGE.get(key);
      if (cached) return json({ ...(JSON.parse(cached) as object), cached: true }, 200, cors);

      const [gemini, openai] = await Promise.all([usageOf(env, "gemini", nowMs), usageOf(env, "openai", nowMs)]);
      const order = pickProviders({
        geminiReady: gemini.configured,
        openaiReady: openai.configured,
        geminiExhausted: gemini.exhausted,
        openaiExhausted: openai.exhausted,
      });
      if (order.length === 0) {
        const anyConfigured = gemini.configured || openai.configured;
        return json(
          {
            error: anyConfigured ? "budget_exhausted" : "no_providers",
            messageAr: anyConfigured
              ? "وصلتِ حدّ الميزانية (اليومي أو الإجمالي) — يرتفع الحد من إعدادات البوابة"
              : "لم تُضبط مفاتيح المزوّدين بعد — هذه خطوة ابنك",
          },
          anyConfigured ? 429 : 503,
          cors
        );
      }

      const sys = slidesSystemPrompt();
      const usr = slidesUserPrompt(lessonTitle, sources);
      let lastError = "";

      // «GPT عامل»: OpenAI أولاً في التوليد، والآخر مشرفاً
      const workOrder: Provider[] = order.includes("openai")
        ? ["openai", ...order.filter((x) => x !== "openai")]
        : order;

      for (const p of workOrder) {
        try {
          const result: CallResult =
            p === "gemini"
              ? await callGeminiJson(env.GEMINI_API_KEY as string, env.GEMINI_MODEL, sys, usr, GEN_LIMITS.maxAnswerTokens)
              : await callOpenAI(env.OPENAI_API_KEY as string, env.OPENAI_MODEL, sys + "\nأخرجي JSON فقط بلا أي نص آخر.", usr, GEN_LIMITS.maxAnswerTokens, env.OPENAI_REASONING_EFFORT || "low");

          const prices =
            p === "gemini"
              ? { inPerM: Number(env.GEMINI_IN_PER_M) || 0, outPerM: Number(env.GEMINI_OUT_PER_M) || 0 }
              : { inPerM: Number(env.OPENAI_IN_PER_M) || 0, outPerM: Number(env.OPENAI_OUT_PER_M) || 0 };
          const costUsd = estimateCostUsd(result.inTokens, result.outTokens, prices);
          ctx.waitUntil(addSpend(env, p, costUsd, nowMs));

          let parsed: unknown;
          try {
            parsed = JSON.parse(result.text.replace(/^```json\s*/, "").replace(/```\s*$/, ""));
          } catch {
            lastError = `${p}: مخرج غير JSON`;
            console.warn("provider_failed", lastError);
            continue; // جرّبي المزوّد التالي — التكلفة سُجّلت بأمانة
          }
          const checked = validateSlidesPayload(parsed);
          if (!checked.ok) {
            lastError = `${p}: ${checked.messageAr}`;
            console.warn("provider_failed", lastError);
            continue;
          }

          // مرحلة المشرفة — مراجعة القوس والكثافة والرسوم بالمزوّد الآخر
          let finalSlides = checked.slides;
          let supCost = 0;
          let supLabel = "";
          const reviewer = (workOrder.find((x) => x !== p) ?? null) as Provider | null;
          if ((env.SUPERVISOR_ENABLED ?? "true") !== "false" && reviewer) {
            try {
              const supUsr = `مسودة العامل (JSON):\n${JSON.stringify(checked.slides)}\n\n${usr}`;
              const r2: CallResult =
                reviewer === "gemini"
                  ? await callGeminiJson(env.GEMINI_API_KEY as string, env.GEMINI_MODEL, supervisorSlidesPrompt(), supUsr, GEN_LIMITS.maxAnswerTokens)
                  : await callOpenAI(env.OPENAI_API_KEY as string, env.OPENAI_MODEL, supervisorSlidesPrompt() + "\nأخرجي JSON فقط بلا أي نص آخر.", supUsr, GEN_LIMITS.maxAnswerTokens, env.OPENAI_REASONING_EFFORT || "low");
              const prices2 =
                reviewer === "gemini"
                  ? { inPerM: Number(env.GEMINI_IN_PER_M) || 0, outPerM: Number(env.GEMINI_OUT_PER_M) || 0 }
                  : { inPerM: Number(env.OPENAI_IN_PER_M) || 0, outPerM: Number(env.OPENAI_OUT_PER_M) || 0 };
              supCost = estimateCostUsd(r2.inTokens, r2.outTokens, prices2);
              ctx.waitUntil(addSpend(env, reviewer, supCost, nowMs));
              const parsed2 = JSON.parse(r2.text.replace(/^```json\s*/, "").replace(/```\s*$/, ""));
              const checked2 = validateSlidesPayload(parsed2);
              if (checked2.ok) {
                finalSlides = checked2.slides;
                supLabel = ` ← مراجعة ${reviewer === "gemini" ? env.GEMINI_MODEL : env.OPENAI_MODEL}`;
              }
            } catch (e) {
              console.warn("supervisor_skipped", String(e));
            }
          }

          const usage = p === "gemini" ? gemini : openai;
          const payload = {
            slides: finalSlides,
            provider: p,
            model: (p === "gemini" ? env.GEMINI_MODEL : env.OPENAI_MODEL) + supLabel,
            costUsd: Math.round((costUsd + supCost) * 1e6) / 1e6,
            alert: alertLevel(usage.totalUsd + costUsd, usage.budgetUsd),
            cached: false,
          };
          ctx.waitUntil(env.USAGE.put(key, JSON.stringify(payload), { expirationTtl: Number(env.CACHE_TTL_SECONDS) || 604800 }));
          return json(payload, 200, cors);
        } catch (e) {
          lastError = e instanceof ProviderError ? `${e.provider} ${e.status}: ${e.message}` : String(e);
          console.warn("provider_failed", lastError);
        }
      }

      return json(
        { error: "providers_failed", messageAr: "تعذّر توليد العرض الآن — حاولي بعد قليل", detail: lastError },
        502,
        cors
      );
    }

    // توليد صورة تعليمية من محتوى الوزارة (استوديو المخرجات)
    if (request.method === "POST" && url.pathname === "/api/generate-image") {
      let body: { prompt?: string };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "bad_json", messageAr: "طلب غير مقروء" }, 400, cors);
      }
      const raw = (body.prompt ?? "").trim();
      if (raw.length < 8 || raw.length > 900) {
        return json({ error: "invalid", messageAr: "وصف الصورة قصير جداً أو طويل جداً" }, 400, cors);
      }

      const openaiUse = await usageOf(env, "openai", nowMs);
      if (!openaiUse.configured) return json({ error: "no_providers", messageAr: "مفتاح توليد الصور لم يُضبط بعد" }, 503, cors);
      if (openaiUse.exhausted) return json({ error: "budget_exhausted", messageAr: "وصلتِ حدّ ميزانية الصور اليوم" }, 429, cors);

      // أسلوب موحّد يفرضه الخادم: رسم تعليمي نظيف، وبلا أي نص داخل الصورة
      // (§ الممنوعات: لا نص عربي مولّداً داخل الصور)
      const prompt = `${raw}\nرسم توضيحي تعليمي مسطّح نظيف لأطفال المرحلة الابتدائية، ألوان دافئة هادئة (عنّابي وذهبي وتركوازي فاتحة)، خلفية بسيطة، دقة علمية للمشهد الموصوف فقط، ومن دون أي نص أو حروف أو أرقام داخل الصورة إطلاقاً.`;

      const key = "img:" + (await cacheKeyOf({ prompt }));
      const cached = await env.USAGE.get(key);
      if (cached) return json({ ...(JSON.parse(cached) as object), cached: true }, 200, cors);

      try {
        const { b64 } = await callOpenAIImage(
          env.OPENAI_API_KEY as string,
          env.OPENAI_IMAGE_MODEL || "gpt-image-1",
          prompt,
          env.IMAGE_QUALITY || "low"
        );
        const costUsd = Number(env.IMAGE_USD_EACH) || 0.02;
        ctx.waitUntil(addSpend(env, "openai", costUsd, nowMs));
        const payload = {
          dataUrl: `data:image/png;base64,${b64}`,
          provider: "openai",
          model: env.OPENAI_IMAGE_MODEL || "gpt-image-1",
          costUsd,
          alert: alertLevel(openaiUse.totalUsd + costUsd, openaiUse.budgetUsd),
          cached: false,
        };
        ctx.waitUntil(env.USAGE.put(key, JSON.stringify(payload), { expirationTtl: Number(env.CACHE_TTL_SECONDS) || 604800 }));
        return json(payload, 200, cors);
      } catch (e) {
        const detail = e instanceof ProviderError ? `${e.provider} ${e.status}: ${e.message}` : String(e);
        console.warn("image_failed", detail);
        return json({ error: "image_failed", messageAr: "تعذّر توليد الصورة الآن — حاولي بعد قليل", detail }, 502, cors);
      }
    }

    return json({ error: "not_found" }, 404, cors);
  },
};
