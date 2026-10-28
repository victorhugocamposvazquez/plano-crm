"use client";
import { useMemo,useRef,useState,type ChangeEvent,type MouseEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { colorCss,drawingColor,filledColors,pdfExtractionSchema,type PdfExtraction } from "@/lib/captura/pdf-extraction";
import { proposeWallCandidates,type LegendRule } from "@/lib/captura/wall-candidates";
import { samplePlan } from "@/lib/captura/sample-plan";
import { calibrationSchema } from "@/lib/captura/schema";
import { metersPerDrawingUnit,polylineLength } from "@/lib/captura/geometry";
import styles from "./planos.module.css";

type Decision="included"|"rejected";
type Review={startX:string;startY:string;endX:string;endY:string;distance:string;reference:string;rules:Record<string,string>;decisions:Record<string,Decision>};
const fresh=(): Review=>({startX:"",startY:"",endX:"",endY:"",distance:"",reference:"",rules:{},decisions:{}});
const sampleReview=(): Review=>({...fresh(),startX:"20",startY:"40",endX:"220",endY:"40",distance:"5",reference:"Referencia ficticia de 5 metros",rules:{"255,0,0":"demolish","0,179,0":"build"}});
const SOURCE_ID="00000000-0000-4000-8000-000000000010",SCALE_ID="00000000-0000-4000-8000-000000000020";
const numberLabel=(value:number)=>new Intl.NumberFormat("es-ES",{maximumFractionDigits:3}).format(value);

export default function PlanLab() {
  const [extraction,setExtraction]=useState<PdfExtraction>(samplePlan),[fileName,setFileName]=useState("Plano de demostración"),[isSample,setIsSample]=useState(true);
  const [pageNumber,setPageNumber]=useState(1),[reviews,setReviews]=useState<Record<number,Review>>({1:sampleReview()});
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [marking,setMarking]=useState<"start"|"end"|null>(null),[highlight,setHighlight]=useState<string|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const [pendingDrawing,setPendingDrawing]=useState<{data:PdfExtraction;label:string;sample:boolean}|null>(null);
  function applyDrawing(next:{data:PdfExtraction;label:string;sample:boolean}) {
    setExtraction(next.data);setFileName(next.label);setIsSample(next.sample);setPageNumber(next.data.pages[0].page);
    setReviews(next.sample?{1:sampleReview()}:{});setError("");setNotice(next.sample?"":"Extracción cargada. Define la escala y confirma la leyenda de cada página.");
    setMarking(null);setHighlight(null);setPendingDrawing(null);
  }
  function requestDrawing(next:{data:PdfExtraction;label:string;sample:boolean}) {
    if(Object.values(reviews).some(r=>Object.keys(r.decisions).length>0)) setPendingDrawing(next); else applyDrawing(next);
  }
  const page=extraction.pages.find(p=>p.page===pageNumber)!;
  const review=reviews[pageNumber] ?? fresh();
  const rules=useMemo(()=>Object.entries(review.rules).flatMap(([key,action])=>action ? [{color:key.split(",").map(Number) as [number,number,number],action:action as LegendRule["action"]}] : []),[review.rules]);
  const detection=useMemo(()=>proposeWallCandidates(page,rules),[page,rules]);
  const colors=useMemo(()=>filledColors(page),[page]);
  const calibration=useMemo(()=>{
    if([review.startX,review.startY,review.endX,review.endY,review.distance,review.reference].some(v=>!v.trim())) return null;
    const result=calibrationSchema.safeParse({id:SCALE_ID,source_id:SOURCE_ID,page:pageNumber,
      start:[Number(review.startX),Number(review.startY)],end:[Number(review.endX),Number(review.endY)],distance_m:Number(review.distance),reference:review.reference});
    if(!result.success) return null;
    const c=result.data;
    if([...c.start,...c.end].some(v=>!Number.isFinite(v)) || c.start[0]>page.width || c.end[0]>page.width || c.start[1]>page.height || c.end[1]>page.height) return null;
    try {metersPerDrawingUnit(c.start,c.end,c.distance_m);return c;} catch {return null;}
  },[review,pageNumber,page.width,page.height]);
  const scale=calibration ? metersPerDrawingUnit(calibration.start,calibration.end,calibration.distance_m) : null;
  const accepted=detection.candidates.filter(c=>review.decisions[c.id]==="included");
  const rejected=detection.candidates.filter(c=>review.decisions[c.id]==="rejected");
  const pending=detection.candidates.length-accepted.length-rejected.length;
  const length=scale===null ? null : accepted.reduce((sum,c)=>sum+polylineLength(c.centerline)*scale,0);
  function updateReview(patch:Partial<Review>,invalidate=true) {
    setReviews(prev=>({...prev,[pageNumber]:{...(prev[pageNumber] ?? fresh()),...patch,...(invalidate?{decisions:{}}:{})}}));
    setNotice("");
  }
  async function loadFile(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]; if(!file) return;
    try {
      if(file.size>20*1024*1024) throw new Error("La extracción supera 20 MiB. Exporta una selección de páginas.");
      const text=await file.text();
      let raw:unknown;try {raw=JSON.parse(text);} catch {throw new Error("El archivo no contiene una extracción JSON válida.");}
      const result=pdfExtractionSchema.safeParse(raw);
      if(!result.success) throw new Error("La extracción no tiene el formato compatible. Usa el lector de planos de PLANO.");
      if(result.data.pages.some(p=>p.paths.length>12000)) throw new Error("Una página supera 12.000 trazados. Requiere una revisión con filtrado previo.");
      requestDrawing({data:result.data,label:file.name,sample:false});
    } catch(e) {setError(e instanceof Error?e.message:"No se pudo abrir la extracción.");}
    event.target.value="";
  }
  function chooseReference(event:MouseEvent<SVGSVGElement>) {
    if(!marking) return;
    const matrix=event.currentTarget.getScreenCTM(); if(!matrix) return;
    const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const x=String(Math.round(Math.max(0,Math.min(page.width,p.x))*1000)/1000),y=String(Math.round(Math.max(0,Math.min(page.height,p.y))*1000)/1000);
    updateReview(marking==="start"?{startX:x,startY:y}:{endX:x,endY:y});
    setMarking(marking==="start"?"end":null);
  }
  function decide(id:string,value:Decision) {
    updateReview({decisions:{...review.decisions,[id]:value}},false);
  }
  function downloadReview() {
    const saved={schema_version:1,kind:"plan_review",review_id:crypto.randomUUID(),source:{label:fileName,sha256:extraction.sha256,synthetic:isSample},
      status:"in_review",persisted_to_project:false,pages:extraction.pages.filter(p=>reviews[p.page]).map(p=>{
        const state=reviews[p.page],legend=Object.entries(state.rules).filter(([,action])=>action).map(([key,action])=>({color:key.split(",").map(Number),action}));
        const result=proposeWallCandidates(p,legend);
        return {page:p.page,reference:state,proposals:result.candidates.map(c=>({...c,decision:state.decisions[c.id] ?? "pending"}))};
      })};
    const blob=new Blob([JSON.stringify(saved,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="revision-plano.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice("Revisión descargada. Todavía no se ha incorporado al proyecto ni al presupuesto.");
  }
  function resetSample() {requestDrawing({data:samplePlan,label:"Plano de demostración",sample:true});}
  return <main className={styles.lab}>
    <header className={styles.header}><div className={styles.identity}><Brand/><span>Laboratorio de mediciones</span></div><ThemeToggle withLabel/></header>
    <section className={styles.intro}><div><p className={styles.eyebrow}>Del plano a una medición revisable</p><h1>Medir planos</h1><p>Confirma la escala y la leyenda. Después, revisa los elementos propuestos.</p></div>
      <div className={styles.actions}><Button onClick={()=>fileInput.current?.click()}>Abrir extracción</Button><Button variant="ghost" onClick={resetSample}>Ver ejemplo</Button></div>
      <input ref={fileInput} type="file" accept=".json,application/json" onChange={loadFile} className={styles.file} aria-label="Abrir extracción de un plano"/>
    </section>
    <div className={styles.banner}>{isSample ? "Ejemplo ficticio · rojo: demoler; verde: construir. Medida de referencia: 5 m." : "Archivo local · la extracción se procesa en esta pestaña y no se envía a un servidor."}</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.workspace}>
      <section className={styles.drawingPanel} aria-label="Plano y referencias">
        <div className={styles.panelHead}><strong>{fileName}</strong><span className={styles.pageSelect}><Select label="Página del plano" value={String(pageNumber)} onChange={value=>{setPageNumber(Number(value));setMarking(null);setHighlight(null);}} options={extraction.pages.map(p=>({value:String(p.page),label:`Página ${p.page}`}))}/></span></div>
        <div className={styles.drawing} data-marking={Boolean(marking)}>
          <svg viewBox={`0 0 ${page.width} ${page.height}`} role="img" aria-label="Trazados del plano. La selección de referencias también se puede introducir con los campos de coordenadas." onClick={chooseReference}>
            {page.paths.map(path=>{
              const fill=path.has_fill && drawingColor(path.fill),stroke=path.has_stroke && drawingColor(path.stroke);
              return <polyline key={path.id} points={[...path.points,...(path.closed?[path.points[0]]:[])].map(p=>p.join(",")).join(" ")} fill={fill?colorCss(fill):"none"} stroke={stroke?colorCss(stroke):"none"} strokeWidth={path.line_width ?? 0.5}/>;
            })}
            {detection.candidates.filter(c=>review.decisions[c.id]!=="rejected").map(c=><polyline key={c.id} points={c.centerline.map(p=>p.join(",")).join(" ")} className={styles.candidateAxis} data-highlight={highlight===c.id} data-accepted={review.decisions[c.id]==="included"} fill="none"/>)}
            {calibration && <g className={styles.referenceLine}><line x1={calibration.start[0]} y1={calibration.start[1]} x2={calibration.end[0]} y2={calibration.end[1]}/><circle cx={calibration.start[0]} cy={calibration.start[1]} r={3}/><circle cx={calibration.end[0]} cy={calibration.end[1]} r={3}/></g>}
          </svg>
        </div>
        <p className={styles.help} aria-live="polite">{marking ? `Marca el ${marking==="start"?"primer":"segundo"} punto de una distancia conocida. También puedes escribir sus coordenadas.` : "Se muestran los trazados lineales extraídos. Las imágenes y las curvas omitidas requieren revisión aparte."}</p>
      </section>
      <aside className={styles.controls} aria-label="Escala y leyenda">
        <section className={styles.card}><h2>1. Define la escala</h2><p>Usa una distancia conocida del plano. Cada página conserva su propia referencia.</p>
          <div className={styles.actions}><Button onClick={()=>setMarking("start")} aria-pressed={Boolean(marking)}>Marcar dos puntos</Button>{marking && <Button variant="ghost" onClick={()=>setMarking(null)}>Cancelar</Button>}</div>
          <div className={styles.coordinates}>{([["startX","Inicio X"],["startY","Inicio Y"],["endX","Fin X"],["endY","Fin Y"]] as const).map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="any" value={review[key]} onChange={e=>updateReview({[key]:e.target.value})}/></label>)}</div>
          <label className={styles.field}>Distancia real (m)<input type="number" min="0.001" step="any" value={review.distance} onChange={e=>updateReview({distance:e.target.value})}/></label>
          <label className={styles.field}>Referencia utilizada<input value={review.reference} placeholder="Por ejemplo: cota de la fachada" maxLength={500} onChange={e=>updateReview({reference:e.target.value})}/></label>
          <p className={styles.status}>{calibration ? "Referencia disponible · pendiente de comprobación" : "Falta una referencia válida para calcular metros"}</p>
        </section>
        <section className={styles.card}><h2>2. Confirma la leyenda</h2><p>El significado de un color depende del plano. Asígnalo antes de buscar tabiques.</p>
          {colors.length===0 && <p>No hay rellenos de color compatibles con este detector.</p>}
          {colors.slice(0,20).map(color=><div key={color.key} className={styles.legendRow}><span className={styles.swatch} style={{backgroundColor:colorCss(color.color)}} aria-hidden="true"/><Select label={`Significado del color RGB ${color.key}`} value={review.rules[color.key] ?? ""} onChange={action=>updateReview({rules:{...review.rules,[color.key]:action}})} options={[{value:"",label:`Sin asignar · ${color.paths} trazados`},{value:"demolish",label:"Demoler"},{value:"build",label:"Construir"},{value:"ignore",label:"Ignorar"}]}/></div>)}
          {colors.length>20 && <p>Hay más de 20 colores. Esta vista muestra los 20 rellenos más frecuentes.</p>}
        </section>
      </aside>
    </div>
    <section className={styles.review}><div className={styles.reviewHead}><div><h2>3. Revisa las propuestas</h2><p>{detection.candidates.length} candidatos · {accepted.length} incluidos · {pending} pendientes · {rejected.length} descartados</p></div><span className={styles.total}>{length===null ? "Sin medida" : `${numberLabel(length)} ml incluidos`}</span></div>
      {detection.duplicate_paths>0 && <p className={styles.help}>{detection.duplicate_paths} trazados duplicados agrupados. Cada franja coincidente se propone una sola vez.</p>}
      {!detection.candidates.length && <p className={styles.empty}>Asigna un significado a los rellenos para buscar franjas rectangulares. Los muros irregulares o sin relleno requieren selección manual en una fase posterior.</p>}
      <div className={styles.candidates}>{detection.candidates.map((candidate,index)=>{
        const decision=review.decisions[candidate.id],quantity=scale===null ? null : polylineLength(candidate.centerline)*scale;
        return <article key={candidate.id} className={styles.candidate} data-highlight={highlight===candidate.id}>
          <div className={styles.candidateTitle}><h3>{candidate.action==="demolish"?"Demoler":"Construir"} · propuesta {index+1}</h3><span>{quantity===null?"Escala pendiente":`${numberLabel(quantity)} ml`}</span></div>
          <p>{decision==="included"?"Incluida en la revisión":decision==="rejected"?"Descartada":"Pendiente de revisión"} · falta altura y comprobación de huecos para obtener m².</p>
          <div className={styles.actions}><Button variant="ghost" onClick={()=>setHighlight(highlight===candidate.id?null:candidate.id)} aria-pressed={highlight===candidate.id}>Localizar</Button><Button disabled={!calibration} aria-pressed={decision==="included"} onClick={()=>decide(candidate.id,"included")}>Incluir</Button><Button aria-pressed={decision==="rejected"} onClick={()=>decide(candidate.id,"rejected")}>Descartar</Button>{decision && <Button variant="ghost" onClick={()=>{const decisions={...review.decisions};delete decisions[candidate.id];updateReview({decisions},false);}}>Reabrir</Button>}</div>
        </article>;
      })}</div>
    </section>
    <footer className={styles.footer}><div><strong>Revisión local · pendiente de incorporar</strong><p>Las propuestas no modifican ningún presupuesto. Cambiar escala o leyenda reabre la revisión de esta página.</p></div><Button variant="primary" onClick={downloadReview}>Descargar revisión</Button></footer>
    <p aria-live="polite" role="status" className={styles.help}>{notice}</p>
    <Modal open={Boolean(pendingDrawing)} onClose={()=>setPendingDrawing(null)} title="Cambiar de plano" footer={<>
      <Button onClick={downloadReview}>Descargar revisión actual</Button><Button onClick={()=>setPendingDrawing(null)}>Cancelar</Button>
      <Button variant="primary" onClick={()=>pendingDrawing && applyDrawing(pendingDrawing)}>Cambiar plano</Button>
    </>}><p>Hay decisiones en la revisión actual. Descárgalas antes de cambiar de archivo si quieres conservarlas.</p></Modal>
  </main>;
}
