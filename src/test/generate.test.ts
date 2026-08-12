import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { studentLevel, LEVEL_LABEL } from "@/lib/generate";

describe("studentLevel — تصنيف مستوى الطالبة (§ الأمر ٨-ج)", () => {
  it("دون ٦٠٪ → دعم", () => {
    expect(studentLevel(0)).toBe("support");
    expect(studentLevel(59.9)).toBe("support");
  });
  it("٦٠ إلى دون ٨٠ → أساسي", () => {
    expect(studentLevel(60)).toBe("basic");
    expect(studentLevel(79.9)).toBe("basic");
  });
  it("٨٠٪ فأكثر → إثراء", () => {
    expect(studentLevel(80)).toBe("enrichment");
    expect(studentLevel(100)).toBe("enrichment");
  });
  it("بلا درجات → أساسي (افتراض آمن)", () => {
    expect(studentLevel(null)).toBe("basic");
  });
  it("التسميات العربية مؤنّثة الاتجاه", () => {
    expect(LEVEL_LABEL.support).toBe("دعم");
    expect(LEVEL_LABEL.enrichment).toBe("إثراء");
  });
});
