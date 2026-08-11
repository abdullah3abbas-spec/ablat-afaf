/**
 * خطّاف النصوص — يعيد نصوص التطبيق + مفردات الطالبات مقلوبة
 * حسب studentGender تلقائياً. لا نص عربي حرفي داخل المكوّنات.
 */
import { useMemo } from "react";
import { ar, genderedVocab } from "@/i18n/ar";
import { useUi } from "@/store/ui";

export function useStrings() {
  const gender = useUi((s) => s.studentGender);
  return useMemo(() => ({ ...ar, g: genderedVocab(gender) }), [gender]);
}
