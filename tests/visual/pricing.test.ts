import { describe,it,expect } from "vitest";
import { demoScenes,initialSceneSelection,visualArticles,visualAssets,visualId,visualOrganization } from "../../src/lib/visual/demo";
import { priceScene,selectSceneAsset } from "../../src/lib/visual/pricing";
const scene=demoScenes[0];
const run=(changes:Partial<Parameters<typeof priceScene>[0]>={})=>priceScene({scene,selection:initialSceneSelection(scene),assets:visualAssets,articles:visualArticles,organization_id:visualOrganization,...changes});
describe("Escena y catálogo comparten artículo y presupuesto",()=>{
  it("incluye los trabajos sin objeto y calcula precios del catálogo por medición",()=>{
    const p=run();expect(p.items).toHaveLength(4);expect(p.amounts.base).toBe(178920);
    expect(p.links[0]).toMatchObject({article_id:visualId(10),measurement_id:visualId(210),asset_revision:"demo-1"});
    expect(p).toMatchObject({status:"local_proposal",review_required:true,persisted:false});
  });
  it("cambiar acabado conserva cantidad e ID de partida y solo cambia su elección",()=>{
    const before=run(),selection=selectSceneAsset({scene,selection:initialSceneSelection(scene),slot_id:scene.slots[0].id,asset_id:visualId(111)}),after=run({selection});
    expect(after.items[0].id).toBe(before.items[0].id);expect(after.items[0].quantity).toBe(12);
    expect(after.amounts.base-before.amounts.base).toBe(24000);expect(after.links[0].article_id).toBe(visualId(11));
    expect(after.items.slice(1)).toEqual(before.items.slice(1));
  });
  it("la instantánea anterior no cambia al actualizar la tarifa",()=>{
    const before=run(),old=structuredClone(before),articles=visualArticles.map(a=>a.id===visualId(10)?{...a,unit_price:9999}:a);
    expect(run({articles}).amounts.base).not.toBe(before.amounts.base);expect(before).toEqual(old);
  });
  it("no factura decoración existente ni cuenta objetos gráficos como unidades",()=>{
    const s=structuredClone(demoScenes[1]),original=priceScene({scene:s,selection:initialSceneSelection(s),assets:visualAssets,articles:visualArticles,organization_id:visualOrganization});
    s.objects.push({...s.objects[0],id:visualId(999)});
    const after=priceScene({scene:s,selection:initialSceneSelection(s),assets:visualAssets,articles:visualArticles,organization_id:visualOrganization});
    expect(after.amounts).toEqual(original.amounts);expect(after.items[2].quantity).toBe(2);expect(after.links).toHaveLength(3);expect(after.warnings.join(" ")).toContain("no coinciden");
  });
  it("rechaza artículos y escenas de otra organización y recursos sin variante permitida",()=>{
    expect(()=>run({organization_id:visualId(999)})).toThrow();
    expect(()=>run({articles:visualArticles.map(a=>({...a,organization_id:visualId(999)}))})).toThrow();
    expect(()=>run({selection:{...initialSceneSelection(scene),[scene.slots[0].id]:visualId(120)}})).toThrow();
    expect(()=>selectSceneAsset({scene,selection:initialSceneSelection(scene),slot_id:visualId(999),asset_id:visualId(111)})).toThrow();
  });
  it("rechaza unidades incompatibles, doble identidad y elecciones sin resolver",()=>{
    expect(()=>run({articles:visualArticles.map(a=>a.id===visualId(10)?{...a,unit:"ud"}:a)})).toThrow();
    expect(()=>run({selection:{}})).toThrow();
    expect(()=>run({scene:{...scene,slots:[scene.slots[0],scene.slots[0]]}})).toThrow();
    expect(()=>run({scene:{...scene,nonvisual_items:[{...scene.nonvisual_items[0],id:scene.slots[0].id}]}})).toThrow();
  });
});
