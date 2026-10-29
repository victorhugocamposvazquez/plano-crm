"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderOpen, FileText, Image as ImageIcon, Film, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { dateLabel, type Document } from "@/lib/domain";
import { categoryNames, categoryOrder, formatSize, isImage, isVideo, type Category } from "@/lib/documentos";
import { documentos, documentosPorProyecto } from "@/lib/resumen";
import { useQueryState } from "@/lib/use-query-state";

/** Todos los documentos de la empresa, por proyecto, con filtro por tipo; se abren igual que desde la ficha. */
export default function DocumentosPage() {
  const { data, loading, fileUrl, notify } = useWorkspace();
  const [categoria, setCategoria] = useQueryState<Category | "">("c", "");
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const filas = useMemo(() => documentos(data, categoria), [data, categoria]);
  const grupos = useMemo(() => documentosPorProyecto(filas), [filas]);
  const conteo = (c: Category) => data.documents.filter(d => d.category === c).length;

  async function abrir(doc: Document) {
    if (abriendo) return;
    setAbriendo(doc.id);
    try { const url = await fileUrl(doc); window.open(url, "_blank", "noopener"); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido abrir el documento."); }
    finally { setAbriendo(null); }
  }

  const Icono = ({ doc }: { doc: Document }) => isImage(doc) ? <ImageIcon size={17} strokeWidth={1.6} aria-hidden="true" /> : isVideo(doc) ? <Film size={17} strokeWidth={1.6} aria-hidden="true" /> : <FileText size={17} strokeWidth={1.6} aria-hidden="true" />;

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><FolderOpen size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <h1 className="h1">Documentos.</h1>
        <p className="subtitle">{loading ? "Cargando…" : `${data.documents.length} archivos en ${new Set(data.documents.map(d => d.project_id)).size} proyectos · planos, contratos, fotos y vídeos`}</p>
      </div>

      <div className="chips chips-scroll" role="group" aria-label="Tipo de documento">
        <button type="button" className="chip" aria-pressed={!categoria} onClick={() => setCategoria("")}>Todos <span className="pl-mono muted">{data.documents.length}</span></button>
        {categoryOrder.map(c => <button key={c} type="button" className="chip" aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? "" : c)}>{categoryNames[c]} <span className="pl-mono muted">{conteo(c)}</span></button>)}
      </div>

      {!loading && grupos.length === 0 && <div className="empty"><strong>{categoria ? `Sin ${categoryNames[categoria].toLowerCase()}` : "Todavía no hay documentos"}</strong><span className="muted text-sm">Los planos, contratos y fotos se adjuntan en cada proyecto, en su pestaña Documentos.</span><Link href="/proyectos" className="btn btn-secondary">Ir a los proyectos</Link></div>}

      {grupos.map(({ project, items }) => (
        <section key={project.id}>
          <div className="section-label">
            <Link href={`/proyectos/${project.id}?s=documents`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--pl-ink)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>{project.name}<ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" /></Link>
            <span className="pl-mono">{items.length}</span>
          </div>
          <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
            {items.map(doc => (
              <button key={doc.id} type="button" className="row-doc row-doc-button" onClick={() => abrir(doc)} disabled={abriendo === doc.id} aria-busy={abriendo === doc.id}>
                <span className="doc-icon"><Icono doc={doc} /></span>
                <span style={{ minWidth: 0, flex: 1 }}><span className="doc-name">{doc.name}</span><small>{categoryNames[doc.category]} · {formatSize(doc.size_bytes)} · {dateLabel(doc.created_at)}</small></span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="muted text-xs">Cada archivo se abre en una pestaña nueva.</p>
    </div>
  );
}
