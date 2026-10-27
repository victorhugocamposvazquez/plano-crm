"use client";
import { useMemo, useState, type ChangeEvent } from "react";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Copy } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { money } from "@/lib/domain";
import { parsearCSV, detectarMapeo, tieneCabecera, filasAArticulos, resumenImportacion, campos, ejemploCSV, type Mapeo, type Campo } from "@/lib/importar-catalogo";

type Fase = "pegar" | "revisar" | "importando" | "hecho";

/**
 * Importación masiva del catálogo: pegar o subir un CSV, comprobar a qué columna va cada campo,
 * ver qué filas entran y cuáles no (y por qué), e importar en lote con progreso. No toca nada hasta el último paso.
 */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, send, notify } = useWorkspace();
  const [texto, setTexto] = useState("");
  const [fase, setFase] = useState<Fase>("pegar");
  const [mapeo, setMapeo] = useState<Mapeo>({});
  const [iva, setIva] = useState("21");
  const [progreso, setProgreso] = useState({ hechas: 0, total: 0, fallos: [] as string[] });

  const filas = useMemo(() => parsearCSV(texto), [texto]);
  const cabecera = tieneCabecera(filas);
  const columnas = useMemo(() => Array.from({ length: Math.max(0, ...filas.map(f => f.length)) }, (_, i) => ({ value: String(i), label: `Columna ${i + 1}${cabecera && filas[0]?.[i] ? ` · ${filas[0][i]}` : filas[1]?.[i] ? ` · «${filas[1][i].slice(0, 24)}»` : ""}` })), [filas, cabecera]);
  const resultado = useMemo(() => (fase === "pegar" ? [] : filasAArticulos(filas, mapeo, data.articles, Number(iva))), [fase, filas, mapeo, data.articles, iva]);
  const resumen = resumenImportacion(resultado);
  const faltan = campos.filter(c => c.obligatorio && mapeo[c.id] === undefined);

  function cerrar() { setTexto(""); setFase("pegar"); setMapeo({}); setProgreso({ hechas: 0, total: 0, fallos: [] }); onClose(); }

  async function archivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notify("El archivo supera 2 MB. Divídelo o quita columnas que sobren."); return; }
    if (/\.xlsx?$/i.test(file.name)) { notify("Guarda la hoja como CSV (Archivo → Guardar como → CSV UTF-8) y vuelve a subirla."); return; }
    setTexto(await file.text());
  }

  function revisar() {
    if (filas.length < 1) { notify("Pega o sube primero el CSV."); return; }
    setMapeo(detectarMapeo(filas)); setFase("revisar");
  }

  async function importar() {
    const comandos = resultado.flatMap(f => (f.comando ? [f.comando] : []));
    if (!comandos.length) return;
    setFase("importando"); setProgreso({ hechas: 0, total: comandos.length, fallos: [] });
    const fallos: string[] = [];
    for (const [i, comando] of comandos.entries()) {
      try { await send(comando); }
      catch (e) { fallos.push(`${comando.code} · ${e instanceof Error ? e.message : "no se ha podido guardar"}`); }
      setProgreso({ hechas: i + 1, total: comandos.length, fallos: [...fallos] });
    }
    setFase("hecho");
    notify(`${comandos.length - fallos.length} artículos importados${fallos.length ? ` · ${fallos.length} con error` : ""}`);
  }

  const footer = fase === "pegar" ? (
    <><Button variant="secondary" onClick={cerrar}>Cancelar</Button><Button variant="primary" onClick={revisar} disabled={!texto.trim()}>Revisar columnas</Button></>
  ) : fase === "revisar" ? (
    <><Button variant="ghost" onClick={() => setFase("pegar")}>Atrás</Button><Button variant="secondary" onClick={cerrar}>Cancelar</Button><Button variant="primary" onClick={importar} disabled={resumen.validas === 0 || faltan.length > 0}>Importar {resumen.validas} artículo{resumen.validas === 1 ? "" : "s"}</Button></>
  ) : fase === "importando" ? (
    <span className="muted text-sm">Importando {progreso.hechas} de {progreso.total}… no cierres la ventana.</span>
  ) : (
    <Button variant="primary" onClick={cerrar}>Cerrar</Button>
  );

  return (
    <Drawer open={open} onClose={fase === "importando" ? () => undefined : cerrar} size="wide" title="Importar catálogo" subtitle="Desde Excel, el programa de presupuestos o cualquier CSV" footer={footer}>
      {fase === "pegar" && (
        <div className="form" style={{ maxWidth: "none" }}>
          <div className="import-drop">
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}><Upload size={16} strokeWidth={1.7} aria-hidden="true" />Subir archivo CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={archivo} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /></label>
            <span className="muted text-sm">o pega abajo las celdas copiadas de Excel (se admiten «;», «,» y tabulador)</span>
          </div>
          <label className="field"><span>Contenido</span><textarea rows={12} value={texto} onChange={e => setTexto(e.target.value)} placeholder={ejemploCSV} spellCheck={false} style={{ fontFamily: "var(--pl-font-mono)", fontSize: 12, minHeight: 220 }} /></label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setTexto(ejemploCSV)}><Copy size={14} strokeWidth={1.8} aria-hidden="true" />Usar el ejemplo</button>
            <span className="muted text-xs">Columnas que entiende: capítulo, descripción, unidad (m², ml, ud, h, global), precio sin IVA, IVA % y código. Sin código, se genera uno por capítulo.</span>
          </div>
          {filas.length > 0 && <p className="text-sm"><FileSpreadsheet size={14} strokeWidth={1.8} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> {filas.length - (cabecera ? 1 : 0)} filas detectadas{cabecera ? " con cabecera" : ""}.</p>}
        </div>
      )}

      {fase === "revisar" && (
        <div className="form" style={{ maxWidth: "none" }}>
          <div className="import-map">
            {campos.map(c => (
              <div key={c.id} className="field">
                <span>{c.label}{c.obligatorio ? "" : <small className="muted"> · opcional</small>}</span>
                <Select size="sm" label={c.label} value={mapeo[c.id] !== undefined ? String(mapeo[c.id]) : ""} placeholder={c.obligatorio ? "Elegir columna…" : "No viene"} onChange={v => setMapeo(m => ({ ...m, [c.id]: Number(v) }))} options={columnas} />
              </div>
            ))}
            <div className="field"><span>IVA si no viene</span><Select size="sm" label="IVA por defecto" value={iva} onChange={setIva} options={[{ value: "21", label: "21 %" }, { value: "10", label: "10 %" }, { value: "0", label: "0 %" }]} /></div>
          </div>
          {faltan.length > 0 && <p className="text-sm" role="alert" style={{ color: "var(--pl-danger)" }}>Falta indicar la columna de: {faltan.map(c => c.label.toLowerCase()).join(", ")}.</p>}

          <div className="import-summary">
            <span data-tone="success"><Check size={14} strokeWidth={2} aria-hidden="true" />{resumen.validas} entran</span>
            <span data-tone="muted">{resumen.duplicadas} ya están en el catálogo</span>
            <span data-tone={resumen.conErrores ? "warning" : "muted"}><AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />{resumen.conErrores} con errores</span>
          </div>

          <div className="import-table-wrap">
            <table className="import-table">
              <thead><tr><th>#</th><th>Capítulo</th><th>Descripción</th><th>Ud</th><th className="num">Precio</th><th>Código</th><th>Estado</th></tr></thead>
              <tbody>
                {resultado.slice(0, 80).map(f => {
                  const c = f.comando;
                  const celdas = (cabecera ? filas[f.fila - 1] : filas[f.fila - 1]) ?? [];
                  const get = (k: Campo) => (mapeo[k] !== undefined ? celdas[mapeo[k]!] ?? "" : "");
                  return (
                    <tr key={f.fila} data-state={c ? "ok" : f.duplicado ? "dup" : "error"}>
                      <td className="pl-mono muted">{f.fila}</td>
                      <td>{c?.chapter ?? get("chapter")}</td>
                      <td className="import-desc">{c?.name ?? get("name")}</td>
                      <td>{c?.unit ?? get("unit")}</td>
                      <td className="num pl-mono">{c ? money(c.unit_price) : get("price")}</td>
                      <td className="pl-mono">{c?.code ?? get("code")}</td>
                      <td>{c ? <span className="status" data-tone="success">Entra</span> : f.duplicado ? <span className="status" data-tone="muted">{f.duplicado === "catalogo" ? "Ya existe" : "Repetida en el archivo"}</span> : <span className="status" data-tone="warning">{f.errores.join(" · ")}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {resultado.length > 80 && <p className="muted text-xs" style={{ padding: "8px 0" }}>Se muestran las 80 primeras de {resultado.length}; se importarán todas las que entran.</p>}
          </div>
          <p className="muted text-xs">Los artículos ya existentes no se tocan: editar precios llegará con el comando de actualización del dominio.</p>
        </div>
      )}

      {(fase === "importando" || fase === "hecho") && (
        <div className="form" style={{ maxWidth: "none" }}>
          <div className="import-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progreso.total} aria-valuenow={progreso.hechas}><i style={{ width: `${progreso.total ? Math.round((progreso.hechas / progreso.total) * 100) : 0}%` }} /></div>
          <p className="text-sm">{fase === "hecho" ? `Importación terminada: ${progreso.total - progreso.fallos.length} artículos nuevos en el catálogo.` : `Guardando artículo ${progreso.hechas} de ${progreso.total}…`}</p>
          {progreso.fallos.length > 0 && <div className="empty" style={{ alignItems: "flex-start", textAlign: "left" }}><strong>{progreso.fallos.length} no se han podido guardar</strong><ul className="text-sm" style={{ paddingLeft: 18 }}>{progreso.fallos.map(f => <li key={f}>{f}</li>)}</ul></div>}
        </div>
      )}
    </Drawer>
  );
}
