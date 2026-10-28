import { z } from "zod";

const id = z.uuid();
const label = z.string().trim().min(1).max(500);
const coordinate = z.number().finite().min(0).max(100000);
export const pointSchema = z.tuple([coordinate, coordinate]);
export const unitSchema = z.enum(["m²", "ml", "ud", "h", "global"]);

/** Fuentes conservadas como evidencia. Una fotografía no declara geometría métrica. */
export const captureSourceSchema = z.object({
  id, kind: z.enum(["manual", "photo", "panorama", "video", "voice", "pdf", "cad", "lidar", "laser_scan", "laser_measure"]),
  label, document_id: id.optional(),
  // Identidad declarada del original; la previsualización no descarga ni verifica el archivo.
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  phase: z.enum(["existing", "demolition", "proposed", "unspecified"]).default("unspecified"),
  legend: z.string().trim().max(2000).default("")
}).strict();

export const calibrationSchema = z.object({
  id, source_id: id, page: z.number().int().min(1).max(10000),
  start: pointSchema, end: pointSchema, distance_m: z.number().positive().max(10000),
  reference: label
}).strict();
const common = { id, source_id: id, label };
export const measurementSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("quantity"), value: z.number().positive().max(1000000), unit: unitSchema,
    method: z.enum(["manual", "laser", "metric_export", "reported", "visual_estimate"]), reference: label }).strict(),
  z.object({ ...common, kind: z.literal("plan_length"), page: z.number().int().min(1).max(10000), calibration_id: id, path_id: z.string().min(1).max(120).optional(),
    points: z.array(pointSchema).min(2).max(500) }).strict(),
  z.object({ ...common, kind: z.literal("plan_area"), page: z.number().int().min(1).max(10000), calibration_id: id, path_id: z.string().min(1).max(120).optional(),
    points: z.array(pointSchema).min(3).max(500) }).strict()
]);
export const formulaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sum"), measurement_ids: z.array(id).min(1).max(100) }).strict(),
  z.object({ kind: z.literal("wall_area"), length_id: id, height_id: id, opening_ids: z.array(id).max(100).default([]) }).strict()
]);
export const intentSchema = z.object({
  id, label, article_id: id.nullable(), formula: formulaSchema,
  inclusion: z.enum(["included", "optional", "excluded"]).default("included"),
  adjustment_percent: z.number().min(-50).max(100).multipleOf(0.01).default(0),
  adjustment_reason: z.string().trim().max(500).default("")
}).strict().refine(v => v.adjustment_percent === 0 || v.adjustment_reason.length > 0, "Indica el motivo del ajuste de precio.");

export const estimateInputSchema = z.object({
  schema_version: z.literal(1), project_id: id,
  scope: z.string().trim().min(1).max(5000),
  sources: z.array(captureSourceSchema).min(1).max(100),
  calibrations: z.array(calibrationSchema).max(100),
  measurements: z.array(measurementSchema).max(500),
  intents: z.array(intentSchema).min(1).max(500)
}).strict().superRefine((value, context) => {
  for (const field of ["sources", "calibrations", "measurements", "intents"] as const) {
    if (new Set(value[field].map(x => x.id)).size !== value[field].length)
      context.addIssue({ code: "custom", path: [field], message: "Hay identificadores repetidos." });
  }
});
export type CaptureSource = z.infer<typeof captureSourceSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type EstimateInput = z.infer<typeof estimateInputSchema>;
export type Point = z.infer<typeof pointSchema>;
