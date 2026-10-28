import { z } from "zod";
import { calibrationSchema,captureSourceSchema,measurementSchema,type Measurement } from "./schema";
import { pdfExtractionSchema } from "./pdf-extraction";
import { proposeWallCandidates } from "./wall-candidates";
import { MeasurementError } from "./geometry";

/** Recalcula el candidato desde su extracción antes de convertir su eje en medición. */
export function measurementFromWallCandidate(raw:{
  extraction:unknown;source:unknown;calibration:unknown;rules:unknown;
  candidate_id:string;measurement_id:string;label:string;
}): Measurement {
  const source=captureSourceSchema.parse(raw.source),calibration=calibrationSchema.parse(raw.calibration);
  const extraction=pdfExtractionSchema.parse(raw.extraction);
  if(source.kind!=="pdf" || source.sha256!==extraction.sha256)
    throw new MeasurementError("source_mismatch","La extracción no corresponde al PDF identificado como fuente.");
  if(calibration.source_id!==source.id)
    throw new MeasurementError("calibration_mismatch","La escala corresponde a otra fuente.");
  const page=extraction.pages.find(p=>p.page===calibration.page);
  if(!page) throw new MeasurementError("missing_page","La página de la referencia no está disponible.");
  if([calibration.start,calibration.end].some(([x,y])=>x>page.width || y>page.height))
    throw new MeasurementError("outside_page","La referencia está fuera de la página.");
  const candidate=proposeWallCandidates(page,raw.rules).candidates.find(c=>c.id===raw.candidate_id);
  if(!candidate) throw new MeasurementError("missing_candidate","La propuesta ya no corresponde al plano o a su leyenda.");
  z.uuid().parse(raw.measurement_id);
  return measurementSchema.parse({
    id:raw.measurement_id,source_id:source.id,label:raw.label,kind:"plan_length",page:page.page,
    calibration_id:calibration.id,points:candidate.centerline,derived_from_path_ids:candidate.source_path_ids
  });
}
