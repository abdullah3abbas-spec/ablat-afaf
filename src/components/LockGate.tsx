/**
 * بوابة القفل (§ الأمر ٩): إن كان القفل مفعّلاً ولم يُفتح هذه الجلسة،
 * تُعرض شاشة إدخال الرقم السرّي قبل التطبيق.
 */
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { isLockEnabled, isUnlockedThisSession, verifyPin, markUnlocked } from "@/lib/lock";
import { useStrings } from "@/hooks/useStrings";

export default function LockGate({ children }: { children: React.ReactNode }) {
  const s = useStrings();
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      if (isUnlockedThisSession() || !(await isLockEnabled())) setState("open");
      else setState("locked");
    })();
  }, []);

  async function submit() {
    if (await verifyPin(pin)) {
      markUnlocked();
      setState("open");
    } else {
      setError(true);
      setPin("");
    }
  }

  if (state === "checking") return null;
  if (state === "open") return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="card w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-maroon/10">
          <Lock className="size-8 text-maroon" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-bold text-maroon">{s.backup.lock.unlock}</h1>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          aria-label={s.backup.lock.unlock}
          className="min-h-touch w-full rounded-card border-2 border-line bg-white px-4 text-center text-2xl tracking-[0.5em] focus:border-teal focus:outline-none"
        />
        {error && <p className="font-medium text-danger">{s.backup.lock.wrong}</p>}
        <button type="button" onClick={() => void submit()} disabled={pin.length < 4} className="btn-primary w-full disabled:opacity-50">
          {s.backup.lock.unlock}
        </button>
      </div>
    </div>
  );
}
