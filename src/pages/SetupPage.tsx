/**
 * رابط الإعداد السحري — يُرسَل للمعلّمة مرة واحدة:
 * ablat-afaf.pages.dev/#/setup?t=رمز_الربط
 * يخزّن الرمز، يفعّل الاتصال بالذكاء، ويتحقق فوراً من صحة البوابة —
 * ثم لا شيء يُطلب منها أبداً. (الرمز يُمسح من الشريط فور الحفظ.)
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Home, PlugZap, XCircle } from "lucide-react";
import { db } from "@/db";
import { DEFAULT_GATEWAY_URL, fetchHealth } from "@/lib/aiClient";
import { useStrings } from "@/hooks/useStrings";
import SchoolEmblem from "@/components/SchoolEmblem";

export default function SetupPage() {
  const s = useStrings();
  const [params] = useSearchParams();
  const [state, setState] = useState<"working" | "ok" | "bad-token" | "no-token">("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = params.get("t")?.trim();
      if (!token) {
        setState("no-token");
        return;
      }
      await db.settings.update(1, {
        aiGatewayUrl: params.get("u")?.trim() || DEFAULT_GATEWAY_URL,
        aiGatewayToken: token,
        aiConnectionEnabled: true,
        updatedAt: Date.now(),
      });
      // امسحي الرمز من الشريط فوراً — لا يبقى في السجل الظاهر
      history.replaceState(null, "", location.pathname + "#/setup");
      try {
        const h = await fetchHealth();
        if (!cancelled) setState(h.ok ? "ok" : "bad-token");
      } catch {
        if (!cancelled) setState("bad-token");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="grid min-h-dvh place-items-center bg-cream p-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="flex flex-col items-center gap-3">
          <SchoolEmblem className="size-16" />
          <h1 className="font-heading text-2xl font-bold text-maroon-dark">{s.setup.title}</h1>
        </div>

        {state === "working" && <p className="card text-lg text-ink-soft">{s.setup.working}</p>}

        {state === "ok" && (
          <div className="card space-y-3 border-2 border-teal">
            <CheckCircle2 className="mx-auto size-14 text-teal" aria-hidden />
            <p className="text-xl font-bold text-teal-dark">{s.setup.ok}</p>
            <p className="text-ink-soft">{s.setup.okHint}</p>
            <Link to="/" className="btn-primary w-full">
              <Home className="size-5" aria-hidden />
              {s.setup.goHome}
            </Link>
          </div>
        )}

        {state === "bad-token" && (
          <div className="card space-y-3 border-2 border-gold">
            <XCircle className="mx-auto size-14 text-gold-dark" aria-hidden />
            <p className="text-xl font-bold text-gold-dark">{s.setup.saved}</p>
            <p className="text-ink-soft">{s.setup.savedHint}</p>
            <Link to="/" className="btn-primary w-full">
              <Home className="size-5" aria-hidden />
              {s.setup.goHome}
            </Link>
          </div>
        )}

        {state === "no-token" && (
          <div className="card space-y-3">
            <PlugZap className="mx-auto size-14 text-ink-soft" aria-hidden />
            <p className="text-lg text-ink-soft">{s.setup.noToken}</p>
            <Link to="/" className="btn-secondary w-full">
              <Home className="size-5" aria-hidden />
              {s.setup.goHome}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
