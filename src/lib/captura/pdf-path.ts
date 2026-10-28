import { z } from "zod";
import { calibrationSchema, captureSourceSchema, measurementSchema, pointSchema, type Measurement } from "./schema";
import { MeasurementError } from "./geometry";

const pageSchema=z.object({
  page:z.number().int().positive(),width:z.number().positive(),height:z.number().positive(),
  coordinate_system:z.literal("pdf_points_top_left_rotation_applied"),
  paths:z.array(z.object({id:z.string().min(1).max(120),points:z.array(pointSchema).min(2).max(500),closed:z.boolean()})).max(50000)
});

/** Une un trazado seleccionado por una persona con su original y escala. No reconoce muros. */
export function measurementFromPdfPath(raw: {
  source: unknown; calibration: unknown;
  extraction: unknown; page: number; path_id: string;
  measurement_id: string; label: string; kind: "plan_length" | "plan_area";
}): Measurement {
  const source=captureSourceSchema.parse(raw.source), calibration=calibrationSchema.parse(raw.calibration);
  // Validar solo la página elegida: los otros trazados no se convierten en mediciones.
  const extraction=z.object({schema_version:z.literal(1),kind:z.literal("pdf_geometry"),sha256:z.string().regex(/^[a-f0-9]{64}$/),
    pages:z.array(z.object({page:z.number().int().positive()}).passthrough()).max(200)}).parse(raw.extraction);
  if(source.kind!=="pdf" || !source.sha256 || source.sha256!==extraction.sha256)
    throw new MeasurementError("source_mismatch","La extracción no corresponde al PDF identificado como fuente.");
  const matches=extraction.pages.filter(p=>p.page===raw.page);
  if(matches.length!==1) throw new MeasurementError("missing_page","La página no está disponible o aparece duplicada.");
  const page=pageSchema.parse(matches[0]);
  if(calibration.source_id!==source.id || calibration.page!==page.page)
    throw new MeasurementError("calibration_mismatch","La referencia de escala corresponde a otra página o fuente.");
  const paths=page.paths.filter(p=>p.id===raw.path_id);
  if(paths.length!==1) throw new MeasurementError("missing_path","El trazado no está disponible o aparece duplicado.");
  const path=paths[0];
  if(raw.kind==="plan_area" && !path.closed)
    throw new MeasurementError("open_contour","El trazado está abierto. Selecciona o dibuja un contorno cerrado.");
  const points=[...path.points,calibration.start,calibration.end];
  if(points.some(([x,y])=>x>page.width || y>page.height))
    throw new MeasurementError("outside_page","El trazado o la escala están fuera de la página.");
  const measurementPoints=raw.kind==="plan_length" && path.closed &&
    (path.points[0][0]!==path.points.at(-1)![0] || path.points[0][1]!==path.points.at(-1)![1])
    ? [...path.points,path.points[0]] : path.points;
  return measurementSchema.parse({id:raw.measurement_id,label:raw.label,source_id:source.id,kind:raw.kind,
    page:raw.page,calibration_id:calibration.id,points:measurementPoints,path_id:raw.path_id});
}
