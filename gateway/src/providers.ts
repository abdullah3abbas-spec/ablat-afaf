/**
 * محوّلات المزوّدين (Provider Adapters) — نداء fetch مباشر بلا مكتبات.
 * كل محوّل يعيد شكلاً موحّداً: النص + عدّادا الـTokens للتكلفة.
 * أسماء النماذج تأتي من الإعدادات (vars) — لا شيء مثبت في الكود.
 */

export interface CallResult {
  text: string;
  inTokens: number;
  outTokens: number;
}

export class ProviderError extends Error {
  constructor(
    public provider: "gemini" | "openai",
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function callGemini(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<CallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new ProviderError("gemini", res.status, (await res.text()).slice(0, 300));
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ProviderError("gemini", 502, "ردّ فارغ من المزوّد");
  return {
    text,
    inTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export async function callOpenAI(apiKey: string, model: string, system: string, user: string, maxTokens: number, effort?: string): Promise<CallResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: maxTokens,
      ...(effort ? { reasoning_effort: effort } : {}),
    }),
  });
  if (!res.ok) throw new ProviderError("openai", res.status, (await res.text()).slice(0, 300));
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new ProviderError("openai", 502, "ردّ فارغ من المزوّد");
  return {
    text,
    inTokens: data.usage?.prompt_tokens ?? 0,
    outTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** نداء Gemini بمخرج JSON إجباري (responseMimeType) — يعيد النص الخام للفحص */
export async function callGeminiJson(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<CallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new ProviderError("gemini", res.status, (await res.text()).slice(0, 300));
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new ProviderError("gemini", 502, "ردّ فارغ من المزوّد");
  return {
    text,
    inTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** نداء OpenAI بمخطط JSON صارم (structured outputs) */
export async function callOpenAIJson(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  jsonSchema: unknown
): Promise<CallResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: maxTokens,
      response_format: { type: "json_schema", json_schema: jsonSchema },
    }),
  });
  if (!res.ok) throw new ProviderError("openai", res.status, (await res.text()).slice(0, 300));
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new ProviderError("openai", 502, "ردّ فارغ من المزوّد");
  return {
    text,
    inTokens: data.usage?.prompt_tokens ?? 0,
    outTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** توليد صورة عبر OpenAI Images — تُعاد base64 (بلا روابط مؤقتة) */
export async function callOpenAIImage(
  apiKey: string,
  model: string,
  prompt: string,
  quality: string
): Promise<{ b64: string }> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024", quality, output_format: "png" }),
  });
  if (!res.ok) throw new ProviderError("openai", res.status, (await res.text()).slice(0, 300));
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError("openai", 502, "ردّ صورة فارغ من المزوّد");
  return { b64 };
}

/** توليد صورة عبر Gemini (نانو بانانا) — نفس عقد الإرجاع b64 */
export async function callGeminiImage(
  apiKey: string,
  model: string,
  prompt: string,
  aspect: string
): Promise<{ b64: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
      }),
    }
  );
  if (!res.ok) throw new ProviderError("gemini", res.status, (await res.text()).slice(0, 300));
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const b64 = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!b64) throw new ProviderError("gemini", 502, "ردّ صورة فارغ من المزوّد");
  return { b64 };
}
