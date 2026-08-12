/**
 * بطاقة الرسالة الأسبوعية (§ الأمر ٨-ج البند ١).
 * تُجهَّز كل خميس بلا طلب من دروس الأسبوع والواجبات والتقييمات.
 * تراجعها المعلّمة وتضيف سطراً إن أرادت ثم تطبع أو ترسل صورةً في الواتساب.
 */
import { useState } from "react";
import { Mail, Printer } from "lucide-react";
import { genWeeklyMessage } from "@/lib/generate";
import { useStrings } from "@/hooks/useStrings";
import { useToast } from "@/store/toast";

export default function WeeklyMessageCard() {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const isThursday = new Date().getDay() === 4; // 4 = الخميس

  async function build() {
    setBusy(true);
    try {
      await genWeeklyMessage(note);
      show(s.weekly.done);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 border-2 border-teal/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-teal-dark">
          <Mail className="size-6" aria-hidden />
          {s.weekly.title}
        </h2>
        {isThursday && <span className="rounded-pill bg-teal-bg px-3 py-1 text-sm font-medium text-teal-dark">{s.weekly.ready}</span>}
      </div>
      <p className="text-ink-soft">{s.weekly.hint}</p>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={s.weekly.extraLine}
        aria-label={s.weekly.extraLine}
        className="min-h-touch w-full rounded-card border-2 border-line bg-white px-4 focus:border-teal focus:outline-none"
      />
      <button type="button" onClick={() => void build()} disabled={busy} className="btn-primary disabled:opacity-50">
        <Printer className="size-5" aria-hidden />
        {busy ? s.weekly.building : s.weekly.button}
      </button>
    </section>
  );
}
