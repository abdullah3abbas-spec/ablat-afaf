/**
 * مرشدة البداية — تظهر مرة واحدة في أول تشغيل (§2-د أسبوع التدريب، الخطوة صفر):
 * ثلاث بطاقات كبيرة بفكرة واحدة لكل بطاقة، بخط ضخم وأزرار مريحة —
 * حتى لا «تتوه» مستخدمة جديدة على الموبايل. تُتخطى بضغطة وتُحفظ للأبد.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Compass, Play, Sparkles } from "lucide-react";
import { db } from "@/db";
import { useStrings } from "@/hooks/useStrings";
import SchoolEmblem from "./SchoolEmblem";

export default function WelcomeTour() {
  const s = useStrings();
  const settings = useLiveQuery(() => db.settings.get(1));
  const [step, setStep] = useState(0);

  // لا تظهر قبل تحميل الإعدادات، ولا بعد إتمامها سابقاً
  if (!settings || settings.onboardingDone) return null;

  const t = s.welcome;
  const steps = [
    { icon: <Compass className="size-12 text-teal-dark" aria-hidden />, title: t.s1Title, body: t.s1Body },
    { icon: <Play className="size-12 text-teal-dark" aria-hidden />, title: t.s2Title, body: t.s2Body },
    { icon: <Sparkles className="size-12 text-teal-dark" aria-hidden />, title: t.s3Title, body: t.s3Body },
  ];
  const last = step === steps.length - 1;

  async function finish() {
    await db.settings.update(1, { onboardingDone: true, updatedAt: Date.now() });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.aria} className="fixed inset-0 z-50 grid place-items-end bg-maroon-deep/50 backdrop-blur-[2px] sm:place-items-center">
      <div className="w-full rounded-t-3xl bg-white p-6 pb-8 shadow-lift sm:max-w-md sm:rounded-3xl sm:pb-6">
        <div className="mb-4 flex items-center gap-3">
          <SchoolEmblem className="size-10" />
          <p className="font-heading text-lg font-bold text-maroon-dark">{t.hello}</p>
        </div>

        <div className="grid size-20 place-items-center rounded-3xl bg-teal-bg">{steps[step].icon}</div>
        <h2 className="mt-3 font-heading text-2xl font-bold">{steps[step].title}</h2>
        <p className="mt-2 text-lg leading-relaxed text-ink-soft">{steps[step].body}</p>

        <div className="mt-5 flex items-center gap-3">
          <div className="me-auto flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={"h-2.5 rounded-pill transition-all " + (i === step ? "w-7 bg-teal" : "w-2.5 bg-line")} />
            ))}
          </div>
          <button type="button" onClick={() => void finish()} className="min-h-touch rounded-card px-3 font-medium text-ink-soft hover:bg-cream">
            {t.skip}
          </button>
          <button
            type="button"
            onClick={() => (last ? void finish() : setStep(step + 1))}
            className="btn-primary min-w-32"
          >
            {last ? t.start : t.next}
          </button>
        </div>
      </div>
    </div>
  );
}
