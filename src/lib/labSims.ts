/**
 * منطق محاكيات المختبر النقي (§2-ج «محاكاة لكل وحدة»):
 * وحدة السلاسل الغذائية: بناء سلسلة صحيحة (منتج أولاً ثم من يتغذى على من)
 * وحدة الدوائر الكهربائية: إضاءة المصابيح في التوالي والتوازي.
 * كل العلاقات من محتوى الكتاب — قابل للاختبار بلا واجهة.
 */

export interface Organism {
  id: string;
  name: string;
  emoji: string;
  /** منتج يصنع غذاءه بنفسه */
  producer?: boolean;
  /** ماذا يأكل (معرّفات) — من الكتاب: صفحات السلاسل الغذائية */
  eats: string[];
}

export const ORGANISMS: Organism[] = [
  { id: "grass", name: "العشب", emoji: "🌱", producer: true, eats: [] },
  { id: "grasshopper", name: "الجرادة", emoji: "🦗", eats: ["grass"] },
  { id: "rabbit", name: "الأرنب", emoji: "🐇", eats: ["grass"] },
  { id: "gazelle", name: "الغزال", emoji: "🦌", eats: ["grass"] },
  { id: "mouse", name: "الفأر", emoji: "🐭", eats: ["grass"] },
  { id: "frog", name: "الضفدع", emoji: "🐸", eats: ["grasshopper"] },
  { id: "snake", name: "الثعبان", emoji: "🐍", eats: ["frog", "mouse"] },
  { id: "falcon", name: "الصقر", emoji: "🦅", eats: ["snake", "mouse", "rabbit"] },
  { id: "lion", name: "الأسد", emoji: "🦁", eats: ["gazelle"] },
];

export const organismById = (id: string): Organism => ORGANISMS.find((o) => o.id === id)!;

/** هل يصح وضع هذا الكائن في الموضع التالي من السلسلة؟ */
export function canPlace(chain: string[], nextId: string): boolean {
  const next = organismById(nextId);
  if (chain.length === 0) return Boolean(next.producer);
  if (chain.includes(nextId)) return false;
  return next.eats.includes(chain[chain.length - 1]);
}

/** الكائنات الصالحة للموضع التالي — لتلوين المتاح ولحكم اكتمال السلسلة */
export function validNext(chain: string[]): string[] {
  return ORGANISMS.map((o) => o.id).filter((id) => canPlace(chain, id));
}

/** السلسلة مكتملة: ٤ مستويات، أو ≥٣ ولا امتداد ممكن */
export function chainComplete(chain: string[]): boolean {
  if (chain.length >= 4) return true;
  return chain.length >= 3 && validNext(chain).length === 0;
}

// ── الدائرة الكهربائية ────────────────────────────────────────

export type CircuitMode = "series" | "parallel";

export interface CircuitState {
  mode: CircuitMode;
  switchClosed: boolean;
  /** المصباحان مركّبان؟ */
  bulbs: [boolean, boolean];
}

/**
 * أيّ المصابيح يضيء؟ — جوهر درسي 2.2 و2.4:
 * التوالي مسار واحد: أي فكّ أو فتح مفتاح يطفئ الكل.
 * التوازي مساران: كل مصباح مركّب يضيء ما دام المفتاح مغلقاً.
 */
export function litBulbs(c: CircuitState): [boolean, boolean] {
  if (!c.switchClosed) return [false, false];
  if (c.mode === "series") {
    const all = c.bulbs[0] && c.bulbs[1];
    return [all, all];
  }
  return [c.bulbs[0], c.bulbs[1]];
}
