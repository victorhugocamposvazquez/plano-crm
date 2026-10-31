import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetComparison } from "@/components/project/budget-comparison";
import { BudgetVersionIdentity } from "@/components/project/budget-version-identity";
import { createDemo } from "@/lib/demo";
import { versionTimestamp } from "@/lib/budget-history";

const demo=createDemo(),base=demo.versions[0];
const versions=()=>{
  const before={...structuredClone(base),number:1,created_at:"2026-10-10T10:00:00Z",updated_at:"2026-10-11T11:00:00Z",items:[{...base.items[0],quantity:10,unit_price:10000,adjustment_percent:0,vat_rate:21}]};
  return {before,after:{...structuredClone(before),id:"00000000-0000-4000-8000-000000000900",number:2,created_at:"2026-10-20T09:00:00Z",updated_at:"2026-10-21T12:00:00Z"}};
};
describe("Comparación comprensible y fechas verificables",()=>{
  it("muestra IVA en el impacto y versiones y fechas explícitas, sin tachar valores",()=>{
    const {before,after}=versions();after.items[0].adjustment_percent=15;
    const html=renderToStaticMarkup(<BudgetComparison before={before} after={after}/>);
    expect(html).toContain("Antes · V1");expect(html).toContain("Después · V2");
    expect(html).toContain("El presupuesto sube 181,50");expect(html).toContain("con IVA");
    expect(html).toContain("10/10/2026");expect(html).toContain("20/10/2026");
    expect(html).toContain("Fecha individual del cambio: no registrada");expect(html).not.toContain("<del");
  });
  it("muestra la última edición real y su autor, aunque la versión se guardara otro día",()=>{
    const {before,after}=versions();after.items[0].quantity=12;after.draft_revision=2;
    const edit={item_id:after.items[0].id,version_id:after.id,draft_revision:2,kind:"changed" as const,fields:["quantity"],occurred_at:"2026-10-20T10:15:00Z",actor_name:"Oficina"};
    const html=renderToStaticMarkup(<BudgetComparison before={before} after={after} edits={[edit,{...edit,draft_revision:1,occurred_at:"2026-10-20T09:15:00Z"},{...edit,draft_revision:3,occurred_at:"2026-10-22T09:15:00Z",actor_name:"Edición posterior"}]}/>);
    expect(html).toContain("Última edición de esta partida en V2");expect(html).toContain('dateTime="2026-10-20T10:15:00Z"');expect(html).toContain("Oficina");
    expect(html).not.toContain("Fecha individual del cambio: no registrada");expect(html).not.toContain("Edición posterior");
    const unrelated=renderToStaticMarkup(<BudgetComparison before={before} after={after} edits={[{...edit,version_id:before.id}]}/>);
    expect(unrelated).toContain("no registrada en este histórico");
  });
  it("distingue un fallo de lectura de la ausencia de registro",()=>{
    const {before,after}=versions();after.items[0].quantity=12;
    const html=renderToStaticMarkup(<BudgetComparison before={before} after={after} editStatus="error"/>);
    expect(html).toContain("No se ha podido consultar la fecha");expect(html).not.toContain("no registrada");
  });
  it("explica un cambio solo de IVA aunque no cambie la base",()=>{
    const {before,after}=versions();after.items[0].vat_rate=10;
    const html=renderToStaticMarkup(<BudgetComparison before={before} after={after}/>);
    expect(html).toContain("El presupuesto baja 110,00");expect(html).toContain("El IVA pasa del 21 % al 10 %");
  });
  it("una alternativa añadida tiene precio pero no se anuncia como subida del presupuesto",()=>{
    const {before,after}=versions();after.items.push({...after.items[0],id:"00000000-0000-4000-8000-000000000901",inclusion:"optional",quantity:1,unit_price:20000});
    const html=renderToStaticMarkup(<BudgetComparison before={before} after={after}/>);
    expect(html).toContain("El total se mantiene");expect(html).toContain("Alternativa añadida");
    expect(html).toContain("Su precio no se suma al presupuesto");expect(html).toContain("No cambia el total del presupuesto");
  });
  it("avisa si las partidas no comparten identidad y no inventa correspondencias por nombre",()=>{
    const {before,after}=versions();after.items[0].id="00000000-0000-4000-8000-000000000902";
    const html=renderToStaticMarkup(<BudgetComparison before={before} after={after}/>);
    expect(html).toContain("no conservan el vínculo");expect(html).toContain("Partida eliminada");expect(html).toContain("Partida añadida");
    expect(html).not.toContain("Partida modificada");
  });
  it("al comparar hacia atrás no presenta la versión nueva como el antes cronológico",()=>{
    const {before,after}=versions();after.items[0].quantity=12;
    const html=renderToStaticMarkup(<BudgetComparison before={after} after={before}/>);
    expect(html).toContain("Referencia · V2");expect(html).toContain("Comparada · V1");expect(html).toContain("El presupuesto baja 242,00");
  });
  it("una actual en borrador y la aprobada para obra quedan separadas por texto",()=>{
    const {before,after}=versions();after.status="draft";
    const current=renderToStaticMarkup(<BudgetVersionIdentity version={after} currentId={after.id} approvedId={before.id}/>);
    const approved=renderToStaticMarkup(<BudgetVersionIdentity version={before} currentId={after.id} approvedId={before.id}/>);
    expect(current).toContain("Actual");expect(current).toContain("Borrador");expect(current).toContain("20/10/2026");
    expect(approved).toContain("Aceptado");expect(approved).not.toContain("Actual");expect(approved).toContain("10/10/2026");
    expect(versionTimestamp("inválida")).toBe("Fecha no disponible");
  });
});
