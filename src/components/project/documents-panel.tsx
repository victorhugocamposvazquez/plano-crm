"use client";
import { useMemo, useState, type ChangeEvent } from "react";
import { FileText, Image as ImageIcon, Film, Upload, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Status } from "@/components/ui/status";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
  const [attaching, setAttaching] = useState(false);
  const rows = useMemo(() => checklist(project.kind, documents), [project.kind, documents]);
  const groups = useMemo(() => groupByCategory(documents), [documents]);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    let added = 0;
    for (const file of files) {
      if (file.size > maxBytes) { notify(`${file.name} supera los 50 MB.`); continue; }
      setUploading(file.name);
      try { await upload(file, project.id, category); added++; notify(`Adjuntado: ${file.name}`); }
      catch (e) { notify(e instanceof Error ? e.message : `No se ha podido subir ${file.name}.`); }
      finally { setUploading(null); }
    }
    if (added === files.length && added > 0) setAttaching(false);
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
    <section className="project-documents" aria-label="Archivos del proyecto">
      <header className="workspace-section-heading"><div><h2>Archivos del proyecto</h2><p className="muted text-sm">{documents.length ? `${documents.length} archivo${documents.length === 1 ? "" : "s"} compartido${documents.length === 1 ? "" : "s"} con el equipo` : "Planos, fotos y documentos en un mismo lugar"}</p></div>{allowed && <Button variant="primary" onClick={() => setAttaching(true)} aria-haspopup="dialog"><Upload {...iconProps}/>Adjuntar</Button>}</header>

      {documents.length === 0 && <div className="documents-empty"><FileText size={28} strokeWidth={1.3} aria-hidden="true"/><strong>Aún no hay archivos</strong><p className="muted">{allowed ? "Pulsa Adjuntar, elige qué vas a subir y selecciona los archivos." : "Los archivos que adjunte el equipo aparecerán aquí."}</p></div>}

      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat} className="document-group" aria-label={categoryNames[cat]}>
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
        </section>
      ))}
      <details className="document-checklist"><summary><span>Documentación del expediente<small className="muted">Qué está adjuntado y qué falta</small></span><span className="document-checklist-count">{rows.filter(r => r.state === "attached").length} de {rows.length}</span></summary>
        <p className="muted text-sm">Tener archivos adjuntos no significa que estén revisados o aprobados.</p>
        <div>{rows.map(row => <div key={row.category} className="document-checklist-row"><span>{row.label}<small className="muted">{row.count ? `${row.count} archivo${row.count === 1 ? "" : "s"}` : "Nada adjuntado todavía"}</small></span><Status label={row.state === "attached" ? "Adjuntado" : "Pendiente"} tone={row.state === "attached" ? "ink" : "warning"}/></div>)}</div>
      </details>
      {allowed && <Modal open={attaching} onClose={() => setAttaching(false)} title="Adjuntar archivos"><div className="document-upload-form">
        <p className="muted text-sm">Se guardan en este proyecto y los ve su equipo.</p>
        <div className="field"><span>¿Qué vas a adjuntar?</span><Select label="Categoría del documento" value={category} onChange={setCategory} options={categoryOrder.map(c => ({ value: c, label: categoryNames[c] }))}/></div>
        <label className="document-file-picker"><span><Upload {...iconProps}/>{uploading ? `Subiendo ${uploading}…` : "Seleccionar archivos"}</span><input aria-label="Seleccionar archivos" type="file" accept={acceptedTypes} multiple disabled={busy || Boolean(uploading)} onChange={onFiles}/></label>
        <p className="muted text-sm" role="status">{uploading ? `Subiendo ${uploading}. Puedes cerrar esta ventana; la subida continuará.` : "PDF, JPG, PNG, WebP o MP4 · hasta 50 MB por archivo."}</p>
      </div></Modal>}
    </section>
  );
}
