"use client";
import { useMemo,useState } from "react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Modal } from "@/components/ui/modal";
import { money,lineTotal } from "@/lib/domain";
import { demoScenes,initialSceneSelection,visualArticles,visualAssets,visualOrganization } from "@/lib/visual/demo";
import { priceScene,selectSceneAsset } from "@/lib/visual/pricing";
import type { SceneSelection } from "@/lib/visual/schema";
import { SpaceView,type SpaceViewer } from "./space-view";
import styles from "./espacio.module.css";
const quantity=(value:number)=>new Intl.NumberFormat("es-ES",{maximumFractionDigits:3}).format(value);
export default function SpaceLab() {
  const [sceneId,setSceneId]=useState(demoScenes[0].id),[selections,setSelections]=useState<Record<string,SceneSelection>>({});
  const [selectedByScene,setSelectedByScene]=useState<Record<string,string>>({}),[viewer,setViewer]=useState<SpaceViewer|null>(null);
  const [view,setView]=useState("overview"),[resetOpen,setResetOpen]=useState(false),[notice,setNotice]=useState("");
  const scene=demoScenes.find(s=>s.id===sceneId)!;
  const selection=useMemo(()=>selections[sceneId] ?? initialSceneSelection(scene),[selections,sceneId,scene]);
  const selected=selectedByScene[sceneId] ?? scene.slots[0].id,slot=scene.slots.find(s=>s.id===selected)!;
  const priced=useMemo(()=>priceScene({scene,selection,assets:visualAssets,articles:visualArticles,organization_id:visualOrganization}),[scene,selection]);
  const initial=useMemo(()=>priceScene({scene,selection:initialSceneSelection(scene),assets:visualAssets,articles:visualArticles,organization_id:visualOrganization}),[scene]);
  const delta=priced.amounts.base-initial.amounts.base;
  const changed=scene.slots.filter(s=>selection[s.id]!==initialSceneSelection(scene)[s.id]).length;
  const selectedAsset=visualAssets.find(a=>a.id===selection[selected])!,selectedArticle=visualArticles.find(a=>a.id===selectedAsset.article_id)!;
  const selectedItem=priced.items.find(i=>i.id===selected)!;
  function select(id:string){setSelectedByScene(prev=>({...prev,[sceneId]:id}));}
  function change(assetId:string) {
    setSelections(prev=>({...prev,[sceneId]:selectSceneAsset({scene,selection,slot_id:selected,asset_id:assetId})}));setNotice("");
  }
  function navigate(mode:"overview"|"inside"|"focus") {viewer?.view(mode);setView(mode);}
  function download() {
    const payload={schema_version:1,kind:"visual_proposal",scene,selection,visual_assets:visualAssets.filter(a=>Object.values(selection).includes(a.id)),
      price_snapshot:priced,initial_price_snapshot:initial,synthetic:true,persisted_to_project:false};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="propuesta-visual-ejemplo.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice("Propuesta de ejemplo descargada. No se ha guardado en un proyecto ni aprobado para obra.");
  }
  return <main className={styles.lab}>
    <header className={styles.header}><div className={styles.identity}><Brand/><span>Propuesta visual</span></div><ThemeToggle withLabel/></header>
    <section className={styles.intro}><div><p className={styles.eyebrow}>Explora el espacio y compara alternativas</p><h1>Ver la propuesta</h1><p>Selecciona un elemento del espacio o de la lista. Cambia su acabado y consulta la diferencia en el presupuesto.</p></div><div className={styles.sceneSelect}><Select label="Espacio de ejemplo" value={sceneId} options={demoScenes.map(s=>({value:s.id,label:s.label}))} onChange={id=>{setSceneId(id);setView("overview");setNotice("");}}/></div></section>
    <div className={styles.demoNotice}>Demostración · espacios, modelos y precios ficticios. La reconstrucción automática desde fotos o planos sigue pendiente.</div>
    <div className={styles.workspace}>
      <section className={styles.visual} aria-label="Recorrido del espacio">
        <div className={styles.views}><Button disabled={!viewer} aria-pressed={view==="overview"} onClick={()=>navigate("overview")}>Vista general</Button><Button disabled={!viewer} aria-pressed={view==="inside"} onClick={()=>navigate("inside")}>Entrar al espacio</Button><Button disabled={!viewer} aria-pressed={view==="focus"} onClick={()=>navigate("focus")}>Ver elemento</Button></div>
        <SpaceView scene={scene} assets={visualAssets} selection={selection} selected={selected} onSelect={select} onReady={setViewer}/>
        <div className={styles.navigation} aria-label="Controles de navegación"><Button disabled={!viewer} onClick={()=>viewer?.command("left")}>Girar a la izquierda</Button><Button disabled={!viewer} onClick={()=>viewer?.command("right")}>Girar a la derecha</Button><Button disabled={!viewer} onClick={()=>viewer?.command("closer")}>Acercar</Button><Button disabled={!viewer} onClick={()=>viewer?.command("farther")}>Alejar</Button></div>
        <p className={styles.help}>Arrastra para girar; usa dos dedos o la rueda para acercar. Los botones permiten navegar sin arrastrar. Vista general abierta; la vista interior muestra los cerramientos del ejemplo.</p>
        <div className={styles.elementList} aria-label="Elementos de la propuesta">{scene.slots.map(s=>{
          const item=priced.items.find(i=>i.id===s.id)!;
          return <button key={s.id} type="button" aria-pressed={selected===s.id} onClick={()=>select(s.id)}><span>{s.label}</span><span className={styles.mono}>{quantity(item.quantity)} {item.unit}</span></button>;
        })}</div>
      </section>
      <aside className={styles.inspector} aria-label="Artículo seleccionado">
        <p className={styles.eyebrow}>Selección · {slot.label}</p><h2>{selectedArticle.name}</h2><p className={styles.reference}>{selectedArticle.code} · representación genérica</p>
        <p className={styles.price}>{money(selectedArticle.unit_price)}<span> / {selectedArticle.unit} · sin IVA</span></p>
        <label className={styles.field}>Alternativa del catálogo<Select label={`Alternativa para ${slot.label}`} value={selectedAsset.id} onChange={change} options={slot.allowed_asset_ids.map(id=>{const asset=visualAssets.find(a=>a.id===id)!,article=visualArticles.find(a=>a.id===asset.article_id)!;return {value:id,label:article.name,hint:`${money(article.unit_price)} / ${article.unit} · sin IVA`};})}/></label>
        <dl className={styles.details}><div><dt>Cantidad presupuestada</dt><dd>{quantity(selectedItem.quantity)} {selectedItem.unit}</dd></div><div><dt>Importe de esta partida</dt><dd>{money(lineTotal(selectedItem))} sin IVA</dd></div>{selectedAsset.dimensions_m && <div><dt>Dimensiones del modelo de ejemplo</dt><dd>{selectedAsset.dimensions_m.map(v=>quantity(v)).join(" × ")} m</dd></div>}</dl>
        <p className={styles.help}>La cantidad procede de una medición declarada del ejemplo. Los modelos son ilustrativos y no certifican dimensiones de productos reales.</p>
        <div className={styles.pricingStatus}><strong>En preparación · propuesta local</strong><p>Sin presupuesto aprobado vinculado.</p></div>
        <div className={styles.amounts}><div><span>Base de la propuesta</span><strong data-testid="visual-base">{money(priced.amounts.base)}</strong></div><div><span>IVA de ejemplo</span><span>{money(priced.amounts.tax)}</span></div><div><span>Total con IVA</span><strong>{money(priced.amounts.total)}</strong></div></div>
        <div className={styles.delta}><span>Diferencia frente al ejemplo inicial · sin IVA</span><strong data-testid="visual-delta">{delta>0?"+":""}{money(delta)}</strong><span>{changed} {changed===1?"elección modificada":"elecciones modificadas"}</span></div>
        <Button variant="primary" onClick={download}>Descargar propuesta de ejemplo</Button><Button disabled={changed===0} onClick={()=>setResetOpen(true)}>Restaurar elecciones iniciales</Button>
      </aside>
    </div>
    <section className={styles.budget} aria-label="Partidas de la propuesta"><div className={styles.sectionHeading}><h2>Lo que incluye el presupuesto</h2><span>Importes sin IVA</span></div><div className={styles.budgetLines}>{priced.items.map(item=><article key={item.id}><div><h3>{item.description}</h3><p>{quantity(item.quantity)} {item.unit} × {money(item.unit_price)}{scene.nonvisual_items.some(i=>i.id===item.id)?" · trabajo sin objeto 3D":" · vinculado a una elección visual"}</p></div><strong>{money(lineTotal(item))}</strong></article>)}</div><p className={styles.help}>Los artículos del ejemplo ya incluyen la instalación indicada en su descripción. Las cajas, la columna existente y el contexto de iluminación no añaden partidas. Los acabados son ilustrativos; no son muestras verificadas del producto.</p><p className={styles.help}>Materiales e iluminación de ejemplo: <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">Poly Haven · CC0</a>. Los recursos se sirven desde PLANO.</p></section>
    {priced.warnings.map(warning=><p key={warning} role="alert" className={styles.help}>{warning}</p>)}
    <p role="status" aria-live="polite" className={styles.notice}>{notice}</p>
    <Modal open={resetOpen} onClose={()=>setResetOpen(false)} title="Restaurar elecciones" footer={<><Button onClick={()=>setResetOpen(false)}>Cancelar</Button><Button variant="primary" onClick={()=>{setSelections(prev=>({...prev,[sceneId]:initialSceneSelection(scene)}));setResetOpen(false);setNotice("Se han restaurado las elecciones iniciales de este ejemplo.");}}>Restaurar</Button></>}><p>Se recuperarán los artículos del ejemplo inicial en este espacio. Puedes descargar antes la propuesta actual para conservarla.</p></Modal>
  </main>;
}
