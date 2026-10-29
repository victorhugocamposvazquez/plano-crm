import { describe,it,expect } from "vitest";
import { createDemo, demoId } from "@/lib/demo";
import { type BudgetVersion } from "@/lib/domain";
import { budgetHistory,compareBudgetHistory,changedText,versionLabel } from "@/lib/budget-history";
import { filasPresupuesto } from "@/lib/resumen";
import { buildAlerts } from "@/lib/hoy";
import { siguientePaso } from "@/lib/siguiente-paso";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetComparison } from "@/components/project/budget-workspace";

const demo=createDemo(),budget=demo.budgets[0],original=demo.versions.find(v=>v.budget_id===budget.id)!;
const version=(number:number,status:BudgetVersion["status"]):BudgetVersion=>({...structuredClone(original),id:demoId(800+number),number,status,budget_id:budget.id});
describe("Historial y revisión actual del presupuesto",()=>{
  it("una cerrada antigua no reaparece como pendiente tras aprobar la siguiente",()=>{
    const first=version(1,"issued"),approved=version(2,"approved"),b={...budget,approved_version_id:approved.id};
    const h=budgetHistory(b,[first,approved]);expect(h.working).toBeUndefined();expect(h.current?.id).toBe(approved.id);
    expect(versionLabel(first,h)).toBe("Terminada · anterior");
    const state={...demo,budgets:[b],versions:[first,approved]};
    expect(filasPresupuesto(state)[0].estado).toBe("approved");expect(buildAlerts(state).some(a=>a.id===`issued-${first.id}`)).toBe(false);
  });
  it("selecciona el borrador nuevo sin depender del orden ni mezclar presupuestos",()=>{
    const first=version(1,"issued"),approved=version(2,"approved"),draft=version(3,"draft"),foreign={...version(99,"draft"),budget_id:demoId(900)};
    const h=budgetHistory({...budget,approved_version_id:approved.id},[first,approved,foreign,draft]);
    expect(h.versions.map(v=>v.number)).toEqual([3,2,1]);expect(h.current?.id).toBe(draft.id);expect(h.approved?.id).toBe(approved.id);
  });
  it("permite comparar dos versiones aunque nunca se hayan aprobado",()=>{
    const first=version(1,"issued"),next=version(2,"draft");next.items[0].quantity+=1;
    const c=compareBudgetHistory(first,next);expect(c.counts.changed).toBe(1);expect(c.hasChanges).toBe(true);expect(c.delta.total).not.toBe(0);
  });
  it("no dice sin diferencias cuando solo cambian condiciones",()=>{
    const first=version(1,"issued"),next={...version(2,"draft"),notes:"Anticipo del 30% y entrega en ocho semanas"};
    const c=compareBudgetHistory(first,next);expect(c.changes).toEqual([]);expect(c.notesChanged).toBe(true);expect(c.hasChanges).toBe(true);expect(c.delta.total).toBe(0);
  });
  it("distingue cambio de IVA sin cambio de base e inclusión de alternativas",()=>{
    const first=version(1,"issued"),next=version(2,"draft");next.items[0].vat_rate=10;
    let c=compareBudgetHistory(first,next);expect(c.delta.base).toBe(0);expect(c.delta.total).toBeLessThan(0);expect(c.changes[0].fields).toContain("vat_rate");
    next.items[0].inclusion="optional";c=compareBudgetHistory(first,next);expect(c.delta.base).toBeLessThan(0);
  });
  it("rechaza comparaciones entre ámbitos y no modifica las versiones",()=>{
    const first=version(1,"issued"),next=version(2,"draft"),copy=structuredClone([first,next]);compareBudgetHistory(first,next);
    expect([first,next]).toEqual(copy);expect(()=>compareBudgetHistory(first,{...next,budget_id:demoId(901)})).toThrow("mismo presupuesto");
  });
  it("resalta inserciones, borrados y texto con tildes sin perder contexto",()=>{
    for(const [a,b] of [["Entrega en seis semanas.","Entrega en ocho semanas."],["","Se conserva la instalación."],["Anticipo del 50%",""],["idéntico","idéntico"]]){
      const d=changedText(a,b);expect(d.prefix+d.before+d.suffix).toBe(a);expect(d.prefix+d.after+d.suffix).toBe(b);
    }
    expect(changedText("Entrega en seis semanas.","Entrega en ocho semanas.")).toEqual({prefix:"Entrega en ",before:"seis",after:"ocho",suffix:" semanas."});
  });
  it("no mezcla aprobadas y revisiones de presupuestos distintos en el siguiente paso",()=>{
    const a=version(1,"approved"),b=version(2,"issued"),second={...budget,id:demoId(902),approved_version_id:null as string|null};
    b.budget_id=second.id;
    const p={...demo.projects.find(p=>p.id===budget.project_id)!,status:"estimating" as const};
    const state={...demo,projects:[p],budgets:[{...budget,approved_version_id:a.id},second],versions:[a,b]};
    let step=siguientePaso(state,p);expect(step.budget_id).toBe(second.id);expect(step.detalle).not.toContain("Sustituirá");expect(step.accion).toBe("aprobar");
    b.status="draft";step=siguientePaso(state,p);expect(step.accion).toBe("cerrar");expect(step.budget_id).toBe(second.id);
    b.items=[];expect(siguientePaso(state,p).accion).toBe("editar");
    b.items=structuredClone(a.items);
    // Al aprobar previamente este segundo ámbito, su aviso debe seguir abriendo ese presupuesto.
    const previous={...version(1,"approved"),id:demoId(903),budget_id:second.id};state.versions.push(previous);second.approved_version_id=previous.id;
    expect(buildAlerts(state).find(alert=>alert.id===`draft-${b.id}`)?.href).toContain(`p=${second.id}`);
  });
  it("explica ajuste e IVA de una partida añadida o eliminada",()=>{
    const first={...version(1,"issued"),items:[]},next=version(2,"draft");
    next.items=[{...next.items[0],quantity:10,unit_price:10000,adjustment_percent:20,vat_rate:21}];
    for(const [before,after] of [[first,next],[next,first]]) {
      const html=renderToStaticMarkup(createElement(BudgetComparison,{before,after}));
      expect(html).toContain("recargo 20 %");expect(html).toContain("IVA 21 %");expect(html).toContain("Importe sin IVA:");expect(html).toContain("1200,00");
    }
  });
});
