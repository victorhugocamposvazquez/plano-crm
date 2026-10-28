import { z } from "zod";
import { itemSchema, lineTotal, totals, type Article, type BudgetItem } from "../domain";
import { estimateInputSchema, type EstimateInput, type Measurement } from "./schema";
import { MeasurementError, metersPerDrawingUnit, polygonArea, polylineLength } from "./geometry";

export type ResolvedMeasurement = {
  id: string; source_id: string; value: number; unit: BudgetItem["unit"];
  basis: "declared_measurement" | "calibrated_geometry" | "visual_estimate";
  calibration_id?: string;
};
export type ProposalLine = {
  id: string; label: string; status: "calculated" | "blocked";
  item: BudgetItem | null; article_id: string | null;
  measurements: ResolvedMeasurement[]; warnings: string[];
  issues: { code: string; message: string }[];
};
const problem = (code: string,message: string): never => { throw new MeasurementError(code,message); };
const roundQuantity = (value: number) => Math.round(value*1000)/1000;

/** Sin IO ni escritura: cualquier entrada de IA se valida igual que una entrada manual. */
export function createEstimateProposal(raw: unknown, context: { organization_id: string; articles: Article[] }) {
  const input = estimateInputSchema.parse(raw);
  const sources=new Map(input.sources.map(s=>[s.id,s]));
  const calibrations=new Map(input.calibrations.map(c=>[c.id,c]));
  const measurements=new Map(input.measurements.map(m=>[m.id,m]));
  const articles=new Map(context.articles.filter(a=>a.organization_id===context.organization_id).map(a=>[a.id,a]));
  const cache=new Map<string,ResolvedMeasurement>();
  const resolve=(id: string): ResolvedMeasurement => {
    const cached=cache.get(id); if(cached) return cached;
    const m=measurements.get(id);
    if(!m) return problem("missing_measurement","Falta una medición necesaria para esta partida.");
    const result=resolveMeasurement(m,sources,calibrations);
    cache.set(id,result); return result;
  };
  const lines: ProposalLine[]=input.intents.map(intent=>{
    const line: ProposalLine={id:intent.id,label:intent.label,status:"blocked",item:null,article_id:intent.article_id,measurements:[],warnings:[],issues:[]};
    try {
      const article=intent.article_id ? articles.get(intent.article_id) : undefined;
      if(!article) problem("missing_article","Selecciona un artículo del catálogo de esta organización.");
      const formula=intent.formula;
      const ids=formula.kind==="sum" ? formula.measurement_ids : [formula.length_id,formula.height_id,...formula.opening_ids];
      const additiveIds=formula.kind==="sum" ? ids : formula.opening_ids;
      if(new Set(additiveIds).size!==additiveIds.length) problem("duplicate_measurement","Una medición aparece sumada o descontada más de una vez.");
      line.measurements=[...new Set(ids)].map(resolve);
      let value: number, unit: BudgetItem["unit"];
      if(formula.kind==="sum") {
        const values=formula.measurement_ids.map(resolve); unit=values[0].unit;
        if(values.some(m=>m.unit!==unit)) problem("unit_mismatch","No se pueden sumar mediciones con unidades diferentes.");
        value=values.reduce((sum,m)=>sum+m.value,0);
      } else {
        const length=resolve(formula.length_id), height=resolve(formula.height_id), openings=formula.opening_ids.map(resolve);
        if(length.unit!=="ml" || height.unit!=="ml" || openings.some(m=>m.unit!=="m²"))
          problem("unit_mismatch","La pared requiere longitud y altura en metros y huecos en metros cuadrados.");
        value=length.value*height.value-openings.reduce((sum,m)=>sum+m.value,0); unit="m²";
      }
      if(article!.unit!==unit) problem("article_unit_mismatch","La unidad de la medición no coincide con la del artículo. Revisa la fórmula o el artículo.");
      const quantity=roundQuantity(value);
      if(quantity<=0 || !Number.isFinite(quantity)) problem("invalid_quantity","La cantidad debe ser positiva; revisa contornos, altura y huecos descontados.");
      const parsed=itemSchema.safeParse({id:intent.id,chapter:article!.chapter,description:article!.name,quantity,unit,
        unit_price:article!.unit_price,vat_rate:article!.vat_rate,adjustment_percent:intent.adjustment_percent,inclusion:intent.inclusion});
      if(!parsed.success) problem("invalid_item","La cantidad o los datos del artículo superan los límites del presupuestador.");
      line.item=parsed.data!; line.status="calculated";
      line.warnings.push("Propuesta pendiente de revisión humana; no se ha guardado en el presupuesto.");
      if(line.measurements.some(m=>m.basis==="visual_estimate")) line.warnings.push("Contiene cantidades estimadas visualmente; no son mediciones verificadas.");
      if(line.measurements.some(m=>m.basis==="declared_measurement")) line.warnings.push("Medidas declaradas: esta previsualización no verifica el instrumento ni el archivo original.");
      if(line.measurements.some(m=>m.basis==="calibrated_geometry")) line.warnings.push("Comprueba la escala, los elementos seleccionados y que el plano no esté deformado.");
    } catch(error) {
      if(!(error instanceof MeasurementError)) throw error;
      line.issues.push({code:error.code,message:error.message});
    }
    return line;
  });
  // Un subtotal parcial jamás se presenta como el precio de toda la reforma.
  const items=lines.flatMap(line=>line.item ? [line.item] : []);
  z.number().max(Number.MAX_SAFE_INTEGER / 1.3, "El subtotal supera el límite seguro de cálculo.").parse(items.reduce((sum,item)=>sum+lineTotal(item),0));
  return {
    schema_version:1 as const, project_id:input.project_id, status:"proposal" as const,
    scope:input.scope, sources:input.sources, calibrations:input.calibrations, measurement_inputs:input.measurements, intents:input.intents, lines,
    priced_subtotal:totals(items), complete:lines.every(line=>line.status==="calculated"),
    pending_line_ids:lines.filter(line=>line.status==="blocked").map(line=>line.id),
    review_required:true as const, persisted:false as const,
    limitations:["Solo incluye las actuaciones solicitadas; no comprueba que cubran toda la reforma.",
      "No determina condiciones ocultas ni interpreta automáticamente los colores del plano.",
      "No se ofrece una horquilla de precisión sin datos que permitan justificarla."]
  };
}

function resolveMeasurement(m: Measurement,
  sources: Map<string,EstimateInput["sources"][number]>,calibrations: Map<string,EstimateInput["calibrations"][number]>): ResolvedMeasurement {
  const source=sources.get(m.source_id);
  if(!source) return problem("missing_source","La medición no tiene una fuente disponible.");
  if(m.kind==="quantity") {
    const allowed={manual:["manual"],laser:["laser_measure"],metric_export:["lidar","laser_scan","cad"],reported:["voice"],visual_estimate:["photo","panorama","video","manual","voice"]};
    if(!allowed[m.method].includes(source.kind)) problem("unsupported_measurement","La fuente no justifica ese método de medición. Una foto o un audio solo aportan estimaciones visuales/declaradas.");
    return {id:m.id,source_id:m.source_id,value:m.value,unit:m.unit,basis:m.method==="visual_estimate"?"visual_estimate":"declared_measurement"};
  }
  if(source.kind!=="pdf" && source.kind!=="cad") problem("unsupported_geometry","La geometría calibrada debe proceder de un plano PDF o CAD.");
  const calibration=calibrations.get(m.calibration_id);
  if(!calibration) return problem("missing_calibration","Falta una referencia de escala para esta medición.");
  if(calibration.source_id!==m.source_id || calibration.page!==m.page) problem("calibration_mismatch","La escala pertenece a otro archivo o página.");
  const scale=metersPerDrawingUnit(calibration.start,calibration.end,calibration.distance_m);
  const value=m.kind==="plan_length" ? polylineLength(m.points)*scale : polygonArea(m.points)*scale*scale;
  return {id:m.id,source_id:m.source_id,value,unit:m.kind==="plan_length"?"ml":"m²",basis:"calibrated_geometry",calibration_id:calibration.id};
}
