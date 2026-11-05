import { describe, it, expect } from "vitest";
import { applyCommand, type Actor } from "@/lib/domain";
import { createDemo, demoId } from "@/lib/demo";
import { deltaManual, estadoStock, movimientosDe, reservado } from "@/lib/stock";

const actor: Actor = { id: demoId(1), name: "Pablo · Demo", role: "office" } as Actor;
let n = 0; const uuid = () => `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`;
const run = (ws: ReturnType<typeof createDemo>, c: Parameters<typeof applyCommand>[1], quien = actor) => applyCommand(ws, c, quien, "2026-11-05T10:00:00.000Z", uuid);
const art = (ws: ReturnType<typeof createDemo>, id: number) => ws.articles.find(a => a.id === demoId(id))!;

describe("Almacén", () => {
  it("entrada, salida y recuento cambian las existencias y quedan registrados", () => {
    let ws = createDemo();
    ws = run(ws, { type: "stock.move", article_id: demoId(39), kind: "entrada", quantity: 20, note: "Pedido a almacén" });
    expect(art(ws, 39).stock_qty).toBe(26);
    ws = run(ws, { type: "stock.move", article_id: demoId(39), kind: "salida", quantity: 5, project_id: demoId(10) });
    expect(art(ws, 39).stock_qty).toBe(21);
    ws = run(ws, { type: "stock.move", article_id: demoId(39), kind: "recuento", quantity: 19 });
    expect(art(ws, 39).stock_qty).toBe(19);
    const nuevos = (ws.stock_movements ?? []).filter(m => m.created_at === "2026-11-05T10:00:00.000Z");
    expect(nuevos.map(m => [m.kind, m.quantity, m.stock_after, m.project_id])).toEqual([["entrada", 20, 26, null], ["salida", -5, 21, demoId(10)], ["recuento", -2, 19, null]]);
    expect(movimientosDe(demoId(39), ws)[0].kind).toBe("entrada");
  });
  it("no deja sacar más de lo que hay ni mover stock de lo que no se guarda", () => {
    const ws = createDemo();
    expect(() => run(ws, { type: "stock.move", article_id: demoId(39), kind: "salida", quantity: 7 })).toThrow("Solo hay 6");
    expect(() => run(ws, { type: "stock.move", article_id: demoId(32), kind: "entrada", quantity: 1 })).toThrow("no se guarda en almacén");
    expect(() => deltaManual("entrada", 0, 5)).toThrow();
    expect(deltaManual("recuento", 0, 5)).toBe(-5);
  });
  it("un pedido ligado suma al recibir y resta al llevar a obra; lo recibido sin llevar queda reservado", () => {
    let ws = createDemo();
    const p = ws.purchases.find(x => x.id === demoId(300))!; // 80 m², 40 recibidos y 40 llevados
    ws = run(ws, { type: "purchase.update", id: p.id, status: "received", received_quantity: 80, delivered_quantity: 40 });
    expect(art(ws, 38).stock_qty).toBe(160);
    expect(reservado(art(ws, 38), ws.purchases)).toBe(40);
    expect(estadoStock(art(ws, 38), ws.purchases)).toMatchObject({ enAlmacen: 160, reservado: 40, libre: 120 });
    ws = run(ws, { type: "purchase.update", id: p.id, status: "delivered", received_quantity: 80, delivered_quantity: 80 });
    expect(art(ws, 38).stock_qty).toBe(120);
    expect(reservado(art(ws, 38), ws.purchases)).toBe(0);
  });
  it("avisa bajo mínimo con lo libre, no con lo que hay", () => {
    const ws = createDemo();
    expect(estadoStock(art(ws, 39), ws.purchases)).toMatchObject({ enAlmacen: 6, libre: 6, bajoMinimo: true });
    expect(estadoStock(art(ws, 38), ws.purchases).bajoMinimo).toBe(false);
  });
  it("un pedido ligado tiene la unidad del artículo y al borrar el artículo el pedido se queda sin vínculo", () => {
    let ws = createDemo();
    expect(() => run(ws, { type: "purchase.create", project_id: demoId(10), name: "Cemento", supplier: "Almacén", quantity: 4, unit: "m²", article_id: demoId(39) })).toThrow("ud");
    ws = run(ws, { type: "article.delete", id: demoId(38) });
    expect(ws.purchases.find(x => x.id === demoId(300))!.article_id).toBeNull();
    expect(movimientosDe(demoId(38), ws)).toHaveLength(0);
  });
  it("el equipo de obra no mueve stock a mano", () => {
    expect(() => run(createDemo(), { type: "stock.move", article_id: demoId(39), kind: "entrada", quantity: 1 }, { ...actor, role: "site" } as Actor)).toThrow();
  });
});
