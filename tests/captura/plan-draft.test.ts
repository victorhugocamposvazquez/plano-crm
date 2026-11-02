import { describe,it,expect } from "vitest";
import { demoActor,demoId } from "@/lib/demo";
import { paredes,resumenParedes } from "@/lib/plano-flujo";
import { planFixture } from "./plan-fixture";
import { applyPlanDraft,planDraftSchema,planSignature } from "@/lib/captura/plan-draft";
describe("Preparación recuperable de planos",()=>{
  it("retoma medidas, geometría y confirmaciones sin modificar partidas ni fotos",()=>{
    const {workspace,draft}=planFixture();const next=applyPlanDraft(workspace,{draft,expected_revision:0},demoActor,"2026-11-02T10:30:00Z");
    const saved=next.plan_captures![0];expect(saved.updated_at).toBe("2026-11-02T10:30:00Z");expect(saved.updated_by_name).toBe(demoActor.name);
    expect(saved.draft).toEqual(draft);expect(resumenParedes(paredes(saved.draft))).toEqual(resumenParedes(paredes(draft)));expect(next.versions).toEqual(workspace.versions);expect(next.room_captures).toBeUndefined();
  });
  it("reintenta sin duplicar y no sobrescribe un cambio remoto",()=>{
    const {workspace,draft}=planFixture(),request={draft,expected_revision:0};const next=applyPlanDraft(workspace,request,demoActor);
    expect(applyPlanDraft(next,request,demoActor)).toBe(next);
    expect(()=>applyPlanDraft(next,{...request,draft:{...draft,altura:"3"}},demoActor)).toThrow(/Otra persona/);
    expect(applyPlanDraft(next,{expected_revision:1,draft:{...draft,altura:"3"}},demoActor).plan_captures![0].revision).toBe(2);
  });
  it("rechaza presupuestos, documentos y permisos ajenos sin perder el original",()=>{
    const {workspace,draft}=planFixture();
    expect(()=>applyPlanDraft(workspace,{draft,expected_revision:0},{...demoActor,role:"viewer"})).toThrow(/perfil/);
    expect(()=>applyPlanDraft(workspace,{draft:{...draft,budgetId:demoId(999)},expected_revision:0},demoActor)).toThrow(/presupuesto/);
    draft.planos[0].documentId=null;expect(()=>applyPlanDraft(workspace,{draft,expected_revision:0},demoActor)).toThrow(/Adjunta el PDF original/);
    expect(workspace.plan_captures).toBeUndefined();
  });
  it("bloquea páginas inexistentes, referencias perdidas y trazos duplicados",()=>{
    const {draft}=planFixture();expect(planDraftSchema.safeParse(draft).success).toBe(true);
    const wrong=structuredClone(draft);wrong.planos[0].page=999;expect(planDraftSchema.safeParse(wrong).success).toBe(false);
    wrong.planos[0].page=1;wrong.medida.planoId=demoId(999);expect(planDraftSchema.safeParse(wrong).success).toBe(false);
    wrong.medida.planoId=null;wrong.planos[0].extraction.pages[0].paths.push(wrong.planos[0].extraction.pages[0].paths[0]);expect(planDraftSchema.safeParse(wrong).success).toBe(false);
  });
  it("compara igual el JSONB reordenado y sigue invalidando la escala cuando cambia la referencia",()=>{
    const {draft}=planFixture();expect(planSignature({...draft,altura:"2,60"})).toBe(planSignature({...Object.fromEntries(Object.entries(draft).reverse()),altura:"2,60"} as typeof draft));
    const modified=structuredClone(draft);modified.medida.metros="4,6";
    expect(resumenParedes(paredes(modified))).not.toEqual(resumenParedes(paredes(draft)));
  });
});
