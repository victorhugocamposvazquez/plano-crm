"use client";
import { useMemo, useState, type ChangeEvent } from "react";
import { FileText, Image as ImageIcon, Film, Upload, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Status } from "@/components/ui/status";
import { Select } from "@/components/ui/select";
import { can, dateLabel, type Document, type Project } from "@/lib/domain";
import { categoryNames, categoryOrder, acceptedTypes, maxBytes, formatSize, isImage, isVideo, checklist, groupByCategory, type Category } from "@/lib/documentos";

const iconProps = { size: 19, strokeWidth: 1.55, "aria-hidden": true } as const;

/** Documentos del expediente: lista de comprobación por tipo de proyecto, subida por categoría y apertura con enlace firmado. */
export function DocumentsPanel({ project, documents }: { project: Project; documents: Document[] }) {
  const { actor, busy, upload, fileUrl, notify } = useWorkspace();
  const allowed = can(actor.role, "document.add");
  const [category, setCategory] = useState<Category>("plan");
  const [uploading, setUploading] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const rows = useMemo(() => checklist(project.kind, documents), [project.kind, documents]);
  const groups = useMemo(() => groupByCategory(documents), [documents]);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files) {
      if (file.size > maxBytes) { notify(`${file.name} supera los 50 MB.`); continue; }
      setUploading(file.name);
      try { await upload(file, project.id, category); notify(`Adjuntado: ${file.name}`); }
      catch (e) { notify(e instanceof Error ? e.message : `No se ha podido subir ${file.name}.`); }
      finally { setUploading(null); }
    }
  }

  async function open(doc: Document) {
    setOpening(doc.id);
    try {
      const url = await fileUrl(doc);
      const win = window.open(url, "_blank", "noopener");
      if (!win) notify("El navegador ha bloqueado la ventana; permite las ventanas emergentes para abrir documentos.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se ha podido abrir el documento.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="section-label" style={{ marginTop: 0 }}><span>Documentación del expediente</span><span className="pl-mono">{rows.filter(r => r.state === "attached").length}/{rows.length}</span></div>
        <div className="panel">
          {rows.map((row, i) => (
            <div key={row.category} className="panel-row" style={i === 0 ? { borderTop: 0 } : undefined}>
              <span style={{ minWidth: 0 }}>{row.label}<small className="muted text-xs" style={{ display: "block", marginTop: 2 }}>{row.count ? `${row.count} archivo${row.count === 1 ? "" : "s"} · pendiente de revisión` : "Nada adjuntado todavía"}</small></span>
              <Status label={row.state === "attached" ? "Adjuntado" : "Pendiente"} tone={row.state === "attached" ? "ink" : "warning"} />
            </div>
          ))}
        </div>
        <p className="muted text-xs" style={{ marginTop: 8 }}>Un archivo adjuntado no es documentación aprobada: la validación por perfil llegará con los permisos definitivos.</p>
      </div>

      {allowed && (
        <div className="uploader">
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <span>Guardar como</span>
            <Select label="Categoría del documento" value={category} onChange={setCategory} options={categoryOrder.map(c => ({ value: c, label: categoryNames[c] }))} />
          </div>
          <label className="btn btn-primary" style={{ cursor: busy || uploading ? "default" : "pointer", opacity: busy || uploading ? 0.6 : 1 }}>
            <Upload {...iconProps} />{uploading ? `Subiendo ${uploading}…` : "Adjuntar"}
            <input type="file" accept={acceptedTypes} multiple disabled={busy || Boolean(uploading)} onChange={onFiles} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
          </label>
          <span className="muted text-xs" style={{ flexBasis: "100%" }}>PDF, JPG, PNG, WebP o MP4 · hasta 50 MB por archivo. Los DWG llegarán con la importación de planos.</span>
        </div>
      )}

      {documents.length === 0 && <div className="empty"><strong>Aún no hay documentos</strong><span className="muted text-sm">Planos, contratos y fotos de antes, durante y después se adjuntan aquí y los ve todo el equipo del proyecto.</span></div>}

      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat}>
          <div className="section-label"><span>{categoryNames[cat]}</span><span className="pl-mono">{list.length}</span></div>
          <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
            {list.map(doc => (
              <button key={doc.id} type="button" className="row-doc doc-row" onClick={() => open(doc)} disabled={opening === doc.id} aria-label={`Abrir ${doc.name}`}>
                <span className="muted">{isImage(doc) ? <ImageIcon {...iconProps} /> : isVideo(doc) ? <Film {...iconProps} /> : <FileText {...iconProps} />}</span>
                <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span><small>{formatSize(doc.size_bytes)} · {dateLabel(doc.created_at)}</small></span>
                <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" className="muted" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
