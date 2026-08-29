/**
 * بروكسي بوابة الذكاء على دومين الموقع نفسه — ablat-afaf.pages.dev/api/*
 *
 * لماذا: بعض الشبكات تحجب نطاق workers.dev كاملاً، وطلبات نفس الأصل
 * لا تحتاج CORS إطلاقاً. هذا يجعل الاتصال يعمل من أي شبكة يعمل منها الموقع.
 * لا أسرار هنا — رمز الربط يمرّره التطبيق كما هو، والتحقق في البوابة نفسها.
 */
const GATEWAY = "https://afaf-ai-gateway.abdullah3abbas.workers.dev";

export async function onRequest({ request, params }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path ?? "");
  const url = new URL(request.url);
  const target = `${GATEWAY}/api/${path}${url.search}`;

  const headers = new Headers();
  const token = request.headers.get("x-afaf-token");
  const contentType = request.headers.get("content-type");
  if (token) headers.set("x-afaf-token", token);
  if (contentType) headers.set("content-type", contentType);

  const init = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
  };

  try {
    const res = await fetch(target, init);
    // نفس الأصل — نعيد الجسد والحالة كما هما، بلا حاجة لرؤوس CORS
    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "gateway_unreachable", messageAr: "تعذّر الوصول للبوابة من الخادم — حاولي بعد قليل" }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}
