import { describe, it, expect } from "vitest";
import { pedidosPorProveedor, lineasHoja, numeroHoja, proveedorSlug } from "@/lib/hoja-pedido";
import type { Purchase } from "@/lib/domain";

const base = { organization_id: "o", project_id: "p", unit: "ud" as const, received_quantity: 0, delivered_quantity: 0 };
const compras: Purchase[] = [
  { ...base, id: "1", name: "Placas", supplier: "Almacén Pérez", quantity: 10, status: "planned" },
  { ...base, id: "2", name: "Tornillería", supplier: "almacen perez", quantity: 5, status: "ordered" },
  { ...base, id: "3", name: "Grifería", supplier: "Fontanería López", quantity: 1, status: "received", received_quantity: 1 },
  { ...base, id: "4", name: "Azulejos", supplier: "Fontanería López", quantity: 40, status: "delivered", received_quantity: 40, delivered_quantity: 40 }
];

describe("Hoja de pedido", () => {
  it("agrupa por proveedor sin acentos ni mayúsculas y cuenta pendientes", () => {
    const grupos = pedidosPorProveedor(compras);
    expect(grupos.map(g => g.slug)).toEqual(["almacen-perez", "fontaneria-lopez"]);
    expect(grupos[0].items).toHaveLength(2);
    expect(grupos[0].pendientes).toBe(2);
    expect(grupos[1].pendientes).toBe(0);
  });

  it("incluye por pedir y pedidos, y deja fuera lo recibido", () => {
    const todo = lineasHoja(compras);
    expect(todo.map(p => p.id)).toEqual(["1", "2"]);
    expect(lineasHoja(compras, false).map(p => p.id)).toEqual(["1"]);
  });

  it("numera la hoja con proyecto, proveedor y fecha", () => {
    expect(numeroHoja({ code: "PL-001" }, "almacen-perez", new Date(2026, 9, 27))).toBe("PL-001 · ALMACEN-PERE · 20261027");
    expect(proveedorSlug("  ")).toBe("sin-proveedor");
  });
});
