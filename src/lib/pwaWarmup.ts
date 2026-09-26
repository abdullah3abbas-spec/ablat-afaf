/**
 * الإحماء الخلفي لكاش الرسمات: بعد الإقلاع وبهدوء (وقت الخمول، طلب
 * واحد كل نصف ثانية، ويتوقف فور انقطاع النت) يجلب كل الأصول الفنية
 * فتمرّ عبر عامل الخدمة وتستقر في art-cache — وبذلك تعمل العروض
 * والشهادات واللوحات كاملةً بلا إنترنت بعد دقائق من أول فتح.
 * لا يعيد جلب المخزون، ولا يزاحم المعلّمة على الشبكة.
 */
import { ART_MANIFEST } from "@/content/artManifest";

const CACHE = "art-cache";
const GAP_MS = 500;

function idle(): Promise<void> {
  return new Promise((r) => {
    if ("requestIdleCallback" in window) (window as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => r());
    else setTimeout(r, 1200);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** يعيد عدد ما جُلب فعلاً — للتشخيص والاختبار */
export async function warmArtCache(urls: string[] = ART_MANIFEST): Promise<number> {
  if (!("caches" in window) || !("serviceWorker" in navigator)) return 0;
  // انتظري سيطرة عامل الخدمة كي تمرّ الجلبات عبره وتُخزَّن
  try {
    await navigator.serviceWorker.ready;
  } catch {
    return 0;
  }
  await idle();
  let fetched = 0;
  const cache = await caches.open(CACHE).catch(() => null);
  for (const url of urls) {
    if (!navigator.onLine) break;
    try {
      if (cache && (await cache.match(url))) continue;
      const res = await fetch(url, { cache: "no-cache" });
      if (res.ok) fetched++;
      await sleep(GAP_MS);
    } catch {
      break; // شبكة تعثّرت — نكمل في إقلاع قادم
    }
  }
  return fetched;
}

/** يُستدعى مرة من الإقلاع — لا ينتظره أحد */
export function startArtWarmup(): void {
  void warmArtCache().catch(() => {});
}
