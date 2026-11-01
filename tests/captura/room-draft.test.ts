import { describe,it,expect } from "vitest";
import { applyCommand } from "@/lib/domain";
import { createDemo,demoActor } from "@/lib/demo";
import { applyRoomCapture, preparedRoomItems, mergeCapturedItems } from "@/lib/captura/room-draft";
import { addRoomWork, attachRoomDocument, newRoom, newRoomSurvey, setRoomQuantity } from "@/lib/captura/room-editor";
import { createRoomProposal, replaceRoomArticle } from "@/lib/captura/room-survey";
const setup=()=>{const data=createDemo(),project=data.projects[0],survey=newRoomSurvey(project.id),article=data.articles.find(a=>a.unit==="m²")!;addRoomWork(survey,survey.rooms[0].id,article);const selection=survey.rooms[0].selections[0];if(selection.kind!=="work")throw new Error();setRoomQuantity(survey,survey.rooms[0].id,selection.intent.id,12.5,"manual",article.unit);return {data,project,survey,article,selection};};
describe("Captura que se puede retomar y revisar",()=>{
  it("una cantidad pendiente no se convierte en cero y no permite incorporar",()=>{
    const {data,survey,selection}=setup();setRoomQuantity(survey,survey.rooms[0].id,selection.intent.id,null,"manual","m²");
    expect(createRoomProposal(survey,{organization_id:data.organization_id,articles:data.articles}).complete).toBe(false);
    expect(()=>preparedRoomItems(survey,data.organization_id,data.articles)).toThrow(/Resuelve/);
  });
  it("guarda zonas, métodos y cambios de artículo sin mezclar unidades",()=>{
    const {data,project,survey,selection}=setup();survey.rooms.push(newRoom("Nave almacén"));
    const stored=applyRoomCapture(data,{action:"save",expected_revision:0,survey},demoActor,project.id,"2026-11-01T12:00:00Z");
    expect(stored.room_captures?.[0]).toMatchObject({revision:1,updated_by_name:demoActor.name});expect(data.room_captures).toBeUndefined();
    const perPiece=data.articles.find(a=>a.unit==="ud")!;
    const swapped=replaceRoomArticle(survey,survey.rooms[0].id,selection.intent.id,perPiece.id);
    expect(swapped.rooms[0].measurements).toEqual(survey.rooms[0].measurements);
    expect(createRoomProposal(swapped,{organization_id:data.organization_id,articles:data.articles}).lines[0].status).toBe("blocked");
  });
  it("una foto no adquiere metros ni mediciones por adjuntarla",()=>{
    const {data,project}=setup(),survey=newRoomSurvey(project.id),doc={id:crypto.randomUUID(),organization_id:data.organization_id,project_id:project.id,name:"360.jpg",category:"before" as const,storage_path:"demo",mime_type:"image/jpeg",size_bytes:20,created_at:"2026-11-01"};
    attachRoomDocument(survey,survey.rooms[0].id,doc,"panorama");expect(survey.rooms[0].measurements).toEqual([]);
    expect(applyRoomCapture({...data,documents:[...data.documents,doc]},{action:"save",expected_revision:0,survey},demoActor,project.id).room_captures?.[0].survey.sources[0].kind).toBe("panorama");
    expect(()=>applyRoomCapture(data,{action:"save",expected_revision:0,survey},demoActor,project.id)).toThrow(/fuente no pertenece/);
  });
  it("incorpora una vez, conserva la aprobada y congela el origen",()=>{
    const {data,project,survey}=setup();const draft=data.versions.find(v=>v.status==="draft" && data.budgets.some(b=>b.id===v.budget_id && b.project_id===project.id))!;
    const saved=applyRoomCapture(data,{action:"save",expected_revision:0,survey},demoActor,project.id),items=preparedRoomItems(survey,data.organization_id,data.articles);
    const request={action:"apply",capture_revision:1,version_id:draft.id,expected_revision:draft.draft_revision,reviewed:true,expected_items:items};
    const next=applyRoomCapture(saved,request,demoActor,project.id);expect(next.room_imports).toHaveLength(1);
    expect(next.versions.filter(v=>v.status==="approved")).toEqual(data.versions.filter(v=>v.status==="approved"));
    expect(applyRoomCapture(next,request,demoActor,project.id)).toEqual(next);
    const changed=structuredClone(survey);changed.rooms[0].label="Nombre nuevo";
    const newer=applyRoomCapture(next,{action:"save",expected_revision:1,survey:changed},demoActor,project.id);
    expect(newer.room_imports![0].survey.rooms[0].label).toBe("Zona 1");
  });
  it("impide perder ediciones manuales y detecta un precio cambiado desde la revisión",()=>{
    const {data,survey}=setup(),items=preparedRoomItems(survey,data.organization_id,data.articles);
    expect(()=>mergeCapturedItems([{...items[0],quantity:99}],items,[])).toThrow(/ya se ha editado/);
    const {project}=setup();expect(()=>applyRoomCapture(data,{action:"save",expected_revision:1,survey},demoActor,survey.project_id)).toThrow(/actualizado/);
    expect(project.id).toBe(survey.project_id);
  });
  it("una nueva revisión conserva el vínculo con la captura y protege la aceptada",()=>{
    const {data,project,survey}=setup(),draft=data.versions.find(v=>v.status==="draft" && data.budgets.some(b=>b.id===v.budget_id && b.project_id===project.id))!;
    let next=applyRoomCapture(data,{action:"save",expected_revision:0,survey},demoActor,project.id);
    next=applyRoomCapture(next,{action:"apply",capture_revision:1,version_id:draft.id,expected_revision:draft.draft_revision,reviewed:true,expected_items:preparedRoomItems(survey,data.organization_id,data.articles)},demoActor,project.id);
    next=applyCommand(next,{type:"budget.issue",version_id:draft.id,expected_revision:draft.draft_revision+1},demoActor);
    next=applyCommand(next,{type:"budget.approve",version_id:draft.id,reference:"Aceptación"},demoActor);
    const accepted=structuredClone(next.versions.find(v=>v.id===draft.id));
    next=applyCommand(next,{type:"budget.revise",version_id:draft.id,reason:"Nueva medición"},demoActor);
    const current=next.versions.find(v=>v.status==="draft" && v.budget_id===draft.budget_id)!;
    const updated=structuredClone(survey);const m=updated.rooms[0].measurements[0];if(m.kind==="quantity")m.value=14;
    next=applyRoomCapture(next,{action:"save",expected_revision:1,survey:updated},demoActor,project.id);
    next=applyRoomCapture(next,{action:"apply",capture_revision:2,version_id:current.id,expected_revision:0,reviewed:true,expected_items:preparedRoomItems(updated,data.organization_id,data.articles)},demoActor,project.id);
    expect(next.versions.find(v=>v.id===draft.id)).toEqual(accepted);expect(next.room_imports).toHaveLength(2);
  });
  it("rechaza el perfil de obra y una captura de otro proyecto",()=>{
    const {data,survey,project}=setup();expect(()=>applyRoomCapture(data,{action:"save",expected_revision:0,survey},{...demoActor,role:"site"},project.id)).toThrow(/perfil/);
    expect(()=>applyRoomCapture(data,{action:"save",expected_revision:0,survey:{...survey,project_id:crypto.randomUUID()}},demoActor,project.id)).toThrow(/otro proyecto/);
  });
});
