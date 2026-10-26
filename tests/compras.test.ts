import { describe, it, expect } from "vitest";
import { accionesPara, comandoPara, pendienteDeRecibir, agruparPorProyecto, resumen } from "@/lib/compras";
import { applyCommand } from "@/lib/domain";
import { createDemo, demoActor, demoId } from "@/lib/demo";

describe("Compras y materiales", () => {
  const data = createDemo();
  const placas = data.purchases.find(p => p.id === demoId(300))!;   // pedido, 40/80 recibido
  const muebles = data.purchases.find(p => p.id === demoId(301))!;  // por pedir

  it("ofrece la acción que toca según el estado", () => {
    expect(accionesPara(muebles).map(a => a.id)).toEqual(["pedir"]);
    expect(accionesPara(placas).map(a => a.id)).toEqual(["recibir"]);
    expect(accionesPara({ ...placas, status: "received", received_quantity: 80 }).map(a => a.id)).toEqual(["entregar"]);
    expect(accionesPara({ ...placas, status: "delivered", received_quantity: 80, delivered_quantity: 80 })).toEqual([]);
  });

  it("los comandos que construye los acepta el dominio", () => {
    let state = applyCommand(data, comandoPara(muebles, "pedir"), demoActor);
    expect(state.purchases.find(p => p.id === muebles.id)!.status).toBe("ordered");
    state = applyCommand(state, comandoPara(placas, "recibir", 20), demoActor);
    const parcial = state.purchases.find(p => p.id === placas.id)!;
    expect(parcial).toMatchObject({ status: "ordered", received_quantity: 60 });
    state = applyCommand(state, comandoPara(parcial, "recibir", 20), demoActor);
    const completo = state.purchases.find(p => p.id === placas.id)!;
    expect(completo).toMatchObject({ status: "received", received_quantity: 80 });
    state = applyCommand(state, comandoPara(completo, "entregar"), demoActor);
    expect(state.purchases.find(p => p.id === placas.id)!).toMatchObject({ status: "delivered", delivered_quantity: 80 });
  });

  it("una recepción mayor que lo pendiente se recorta a la cantidad pedida", () => {
    const cmd = comandoPara(placas, "recibir", 500);
    expect(cmd.type === "purchase.update" && cmd.received_quantity).toBe(80);
    expect(pendienteDeRecibir(placas)).toBe(40);
  });

  it("agrupa por proyecto con los pedidos en curso primero y resume por estado", () => {
    const grupos = agruparPorProyecto(data, data.purchases);
    expect(grupos.map(g => g.project.name)).toEqual(["Cocina abierta al salón", "Vivienda en Monte Alto"]);
    expect(resumen(data.purchases)).toEqual({ porPedir: 1, pedidos: 1, recibidos: 0, enObra: 0 });
  });
});
