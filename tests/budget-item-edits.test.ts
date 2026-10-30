import { describe,it,expect } from "vitest";
import { applyCommand } from "@/lib/domain";
import { createDemo,demoActor,demoId } from "@/lib/demo";

describe("Registro de partidas en la demostración",()=>{
  it("conserva cada guardado con autor, instantáneas y fecha, sin alterar el aprobado",()=>{
    const before=createDemo(),draft=before.versions.find(v=>v.status==="draft")!,approved=before.versions.find(v=>v.status==="approved");
    const items=structuredClone(draft.items);items[0].quantity+=2;items.pop();
    const date="2026-10-30T09:15:22Z";
    const after=applyCommand(before,{type:"budget.save",version_id:draft.id,expected_revision:draft.draft_revision,items,notes:draft.notes},demoActor,date);
    expect(before.budget_item_events).toBeUndefined();
    expect(after.budget_item_events?.map(e=>e.kind)).toEqual(["changed","removed"]);
    expect(after.budget_item_events?.[0]).toMatchObject({occurred_at:date,actor_name:demoActor.name,fields:["quantity"],draft_revision:draft.draft_revision+1});
    expect(after.budget_item_events?.[0].before_item?.quantity).toBe(draft.items[0].quantity);
    expect(after.versions.find(v=>v.id===approved?.id)).toEqual(approved);
    const saved=after.versions.find(v=>v.id===draft.id)!;
    const again=applyCommand(after,{type:"budget.save",version_id:draft.id,expected_revision:saved.draft_revision,items:[...items].reverse(),notes:"Solo condiciones"},demoActor,"2026-10-30T10:15:22Z");
    expect(again.budget_item_events).toEqual(after.budget_item_events);
  });
  it("una revisión copiada conserva el historial y no atribuye nuevas ediciones",()=>{
    const demo=createDemo();demo.versions=demo.versions.filter(v=>v.status!=="draft");
    const before=demo.versions[0];
    const next=applyCommand(demo,{type:"budget.revise",version_id:before.id,reason:"Alternativa"},demoActor,"2026-10-30T10:00:00Z",()=>demoId(880));
    expect(next.budget_item_events).toBeUndefined();expect(next.versions.at(-1)?.items).toEqual(before.items);
  });
});
