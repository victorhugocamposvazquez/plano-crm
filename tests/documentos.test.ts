import { describe, it, expect } from "vitest";
import { checklist, groupByCategory, formatSize, requiredCategories, categoryOrder, categoryNames } from "@/lib/documentos";
import type { Document } from "@/lib/domain";
import { demoId } from "@/lib/demo";

const doc = (category: Document["category"], n: number, created = "2026-10-26T10:00:00.000Z"): Document => ({ id: demoId(700 + n), organization_id: demoId(2), project_id: demoId(10), name: `doc-${n}.pdf`, category, storage_path: `${demoId(2)}/${demoId(10)}/${n}`, mime_type: "application/pdf", size_bytes: 1024 * n, created_at: created });

describe("Expediente documental", () => {
  it("la lista de comprobación marca pendiente lo que falta y cuenta lo adjuntado", () => {
    const rows = checklist("integral", [doc("plan", 1), doc("plan", 2), doc("before", 3)]);
    expect(rows.find(r => r.category === "plan")).toMatchObject({ state: "attached", count: 2 });
    expect(rows.find(r => r.category === "contract")).toMatchObject({ state: "pending", count: 0 });
    expect(rows.map(r => r.category)).toEqual(requiredCategories("integral"));
  });

  it("las reformas parciales y la carpintería piden menos documentación que una integral", () => {
    expect(requiredCategories("partial").length).toBeLessThan(requiredCategories("integral").length);
    expect(requiredCategories("carpentry")).not.toContain("plan");
  });

  it("agrupa por categoría en el orden del expediente y lo más reciente primero", () => {
    const groups = groupByCategory([doc("other", 1), doc("plan", 2, "2026-10-01T00:00:00.000Z"), doc("plan", 3, "2026-10-20T00:00:00.000Z")]);
    expect([...groups.keys()]).toEqual(["plan", "other"]);
    expect(groups.get("plan")!.map(d => d.name)).toEqual(["doc-3.pdf", "doc-2.pdf"]);
  });

  it("toda categoría del dominio tiene nombre y posición", () => {
    for (const category of categoryOrder) expect(categoryNames[category]).toBeTruthy();
    expect(new Set(categoryOrder).size).toBe(7);
  });

  it("formatea tamaños legibles", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(20 * 1024)).toBe("20 KB");
    expect(formatSize(3.5 * 1024 * 1024)).toBe("3,5 MB");
  });
});
