"use client";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { BookmarkPlus, Copy, LayoutList, Pencil, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ChecklistEditor } from "@/components/project/lista-tarea";
import { can, type PuntoLista, type TaskTemplate } from "@/lib/domain";
import { puntoNuevo } from "@/lib/lista-tarea";
import { aplicarPlantilla, plantillasDisponibles, plantillasTarea, propiaConNombre, sugerirPlantilla, textosDePlantilla, type PlantillaTarea } from "@/lib/plantillas-tarea";

/** Lo que se edita en la ficha de una plantilla. `id` es la propia que se corrige; sin él, se guarda una nueva. */
type Borrador = { id?: string; nombre: string; oficio: string; subtareas: PuntoLista[] };

/**
 * Plantillas de subtareas junto al editor: la sugerida por el título como chip («Añadir las de Pintar paredes»)
 * y todas en «Plantillas», primero las de la empresa. Al aplicar una se añaden sus subtareas (sin repetir) y, si el
 * oficio estaba sin elegir, el suyo. Quien puede crear tareas también guarda las subtareas como plantilla y las gestiona.
 */
export function PlantillasTarea({ titulo, oficio = "", subtareas, onAplicar }: { titulo: string; oficio?: string; subtareas: PuntoLista[]; onAplicar: (lista: PuntoLista[], plantilla: PlantillaTarea) => void }) {
  const { data, actor } = useWorkspace();
  const [ficha, setFicha] = useState<Borrador | null>(null);
  const [gestionar, setGestionar] = useState(false);
  const todas = useMemo(() => plantillasDisponibles(data.task_templates), [data.task_templates]);
  const puedeGuardar = can(actor.role, "template.create");
  const sugerida = sugerirPlantilla(titulo, todas);
  const yaAplicada = (p: PlantillaTarea) => p.subtareas.every(s => subtareas.some(x => x.text.trim().toLocaleLowerCase("es") === s.toLocaleLowerCase("es")));
  const aplicar = (p: PlantillaTarea) => onAplicar(aplicarPlantilla(subtareas, p), p);
  const textos = textosDePlantilla(subtareas);

  function guardarComo() {
    // Siempre se guarda como nueva; si el nombre propuesto (el de la plantilla sugerida) ya es de una propia, la ficha
    // avisa de que se sustituirán sus subtareas, y basta cambiar el nombre para tener otra.
    const base = sugerida?.propia ?? null;
    setFicha({ nombre: base?.name ?? (sugerida && !sugerida.propia ? sugerida.nombre : titulo.trim()).slice(0, 80), oficio: oficio || base?.trade || sugerida?.oficio || "", subtareas: textos.map(puntoNuevo) });
  }

  const items: MenuItem[] = [
    ...todas.map(p => ({ id: p.id, label: p.nombre, hint: `${p.propia ? "De la empresa · " : ""}${p.subtareas.length} subtareas${p.oficio ? ` · ${p.oficio}` : ""}${yaAplicada(p) ? " · ya añadidas" : ""}`, disabled: yaAplicada(p), onSelect: () => aplicar(p) })),
    ...(puedeGuardar ? [
      { id: "guardar", label: "Guardar estas subtareas como plantilla…", hint: textos.length ? `${textos.length} subtareas, para usarlas en otras tareas` : "Añade antes alguna subtarea", icon: <BookmarkPlus size={15} strokeWidth={1.7} />, disabled: !textos.length, onSelect: guardarComo },
      { id: "gestionar", label: "Gestionar plantillas…", hint: "Corregir, copiar o borrar las de la empresa", icon: <Settings2 size={15} strokeWidth={1.7} />, onSelect: () => setGestionar(true) }
    ] : [])
  ];

  return <div className="plantillas-tarea">
    {sugerida && !yaAplicada(sugerida) && <button type="button" className="chip plantilla-sugerida" onClick={() => aplicar(sugerida)}><Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />Añadir las de «{sugerida.nombre}» · {sugerida.subtareas.length}</button>}
    <Menu size="md" label="Plantillas de subtareas" align="start" trigger={<><LayoutList size={15} strokeWidth={1.7} aria-hidden="true" />Plantillas</>} items={items} />
    <FichaPlantilla borrador={ficha} onClose={() => setFicha(null)} />
    <GestionarPlantillas open={gestionar} onEditar={b => { setGestionar(false); setFicha(b); }} onClose={() => setGestionar(false)} />
  </div>;
}

/** Guardar o corregir una plantilla de la empresa: nombre, oficio y subtareas (solo el texto, sin asignar). */
function FichaPlantilla({ borrador, onClose }: { borrador: Borrador | null; onClose: () => void }) {
  const { data, send, notify, busy } = useWorkspace();
  const formId = `ficha-plantilla-${useId().replace(/:/g, "")}`;
  const [form, setForm] = useState<Borrador>({ nombre: "", oficio: "", subtareas: [] });
  const [pendiente, setPendiente] = useState(false), [fallo, setFallo] = useState("");
  useEffect(() => { if (borrador) { setForm(borrador); setFallo(""); } }, [borrador]);

  // Otra plantilla propia con ese nombre: se corrige esa en lugar de chocar. Una de base con ese nombre queda sustituida.
  const choca = propiaConNombre(data.task_templates, form.nombre);
  const destino = form.id ?? choca?.id;
  const sustituyeBase = !choca && plantillasTarea.find(p => p.nombre.toLocaleLowerCase("es") === form.nombre.trim().toLocaleLowerCase("es"));
  const textos = textosDePlantilla(form.subtareas);

  async function guardar(e: FormEvent) {
    // Se abre desde el formulario de la tarea: su envío no debe enviar también el de debajo.
    e.preventDefault(); e.stopPropagation();
    if (pendiente || busy || !form.nombre.trim() || !textos.length) return;
    setPendiente(true); setFallo("");
    const campos = { name: form.nombre.trim(), trade: form.oficio.trim(), subtasks: textos };
    try {
      await send(destino ? { type: "template.update", id: destino, ...campos } : { type: "template.create", ...campos });
      notify(destino ? `Plantilla actualizada: ${campos.name}` : `Plantilla guardada: ${campos.name}. Ya aparece en «Plantillas» para todo el equipo.`);
      onClose();
    } catch (err) { setFallo(err instanceof Error ? err.message : "No se ha podido guardar la plantilla."); }
    finally { setPendiente(false); }
  }

  return <Modal open={Boolean(borrador)} onClose={onClose} title={form.id ? "Corregir plantilla" : "Guardar como plantilla"} kicker="Plantillas de tarea" footer={<>
    <Button variant="secondary" onClick={onClose} disabled={pendiente}>Cancelar</Button>
    <Button variant="primary" type="submit" form={formId} disabled={pendiente || busy || !form.nombre.trim() || !textos.length}>{pendiente ? "Guardando…" : form.id ? "Guardar cambios" : choca ? "Sustituir plantilla" : "Guardar plantilla"}</Button>
  </>}>
    <form id={formId} className="form" onSubmit={guardar} style={{ maxWidth: "none" }}>
      <div className="line-grid">
        <label className="field"><span>Nombre</span><input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Pintar fachada" required maxLength={80} autoFocus /></label>
        <label className="field"><span>Oficio</span><input type="text" value={form.oficio} onChange={e => setForm({ ...form, oficio: e.target.value })} placeholder="Pintura" maxLength={120} /></label>
      </div>
      {!form.id && choca && <p className="plantilla-aviso">Ya hay una plantilla «{choca.name}»: se sustituirán sus subtareas por estas.</p>}
      {sustituyeBase && <p className="plantilla-aviso">Sustituye a la de base «{sustituyeBase.nombre}»: desde ahora el equipo verá la vuestra.</p>}
      <div className="field"><span>Subtareas · {textos.length}</span><ChecklistEditor value={form.subtareas} onChange={l => setForm({ ...form, subtareas: l })} marcar={false} /></div>
      <small className="muted">Se guarda solo el texto: al usarla, las subtareas llegan sin marcar y sin asignar. Se sugiere sola cuando el título de la tarea lleva palabras de su nombre.</small>
      {fallo && <p role="alert" className="auth-error">{fallo}</p>}
    </form>
  </Modal>;
}

/** Las plantillas de la empresa (corregir o borrar) y las de base (copiar para adaptarlas). */
function GestionarPlantillas({ open, onEditar, onClose }: { open: boolean; onEditar: (b: Borrador) => void; onClose: () => void }) {
  const { data, send, notify, busy } = useWorkspace();
  const [borrando, setBorrando] = useState("");
  const propias = useMemo(() => [...(data.task_templates ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es")), [data.task_templates]);
  const base = plantillasDisponibles(data.task_templates).filter(p => !p.propia);
  const sustituidas = plantillasTarea.filter(p => !base.includes(p));
  useEffect(() => { if (!open) setBorrando(""); }, [open]);
  const editar = (t: TaskTemplate) => onEditar({ id: t.id, nombre: t.name, oficio: t.trade, subtareas: t.subtasks.map(puntoNuevo) });
  const copiar = (p: PlantillaTarea) => onEditar({ nombre: p.nombre, oficio: p.oficio, subtareas: p.subtareas.map(puntoNuevo) });

  async function borrar(t: TaskTemplate) {
    try { await send({ type: "template.delete", id: t.id }); notify(`Plantilla borrada: ${t.name}`); setBorrando(""); }
    catch (err) { notify(err instanceof Error ? err.message : "No se ha podido borrar la plantilla."); }
  }

  return <Modal open={open} onClose={onClose} title="Plantillas de tarea" kicker="Para todo el equipo" footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
    <div className="plantillas-gestion">
      <section aria-labelledby="plantillas-propias">
        <h4 id="plantillas-propias">De la empresa · {propias.length}</h4>
        {propias.length === 0 && <p className="muted text-sm">Todavía no hay ninguna. Guarda las subtareas de una tarea con «Plantillas → Guardar estas subtareas como plantilla…», o copia una de base para adaptarla.</p>}
        <ul>
          {propias.map(t => <li key={t.id}>
            <span><strong>{t.name}</strong><small>{t.subtasks.length} subtareas{t.trade ? ` · ${t.trade}` : ""}{t.created_by_name ? ` · ${t.created_by_name}` : ""}{sustituidas.some(p => p.nombre.toLocaleLowerCase("es") === t.name.toLocaleLowerCase("es")) ? " · sustituye a la de base" : ""}</small></span>
            {borrando === t.id
              ? <span className="catalog-danger"><span className="text-sm">¿Borrar?</span><Button variant="ghost" className="danger" onClick={() => void borrar(t)} disabled={busy}>Sí</Button><Button variant="ghost" onClick={() => setBorrando("")}>No</Button></span>
              : <span className="plantillas-acciones">
                <Button variant="ghost" onClick={() => editar(t)} aria-label={`Corregir ${t.name}`}><Pencil size={15} strokeWidth={1.7} aria-hidden="true" />Corregir</Button>
                <Button variant="ghost" className="danger" onClick={() => setBorrando(t.id)} aria-label={`Borrar ${t.name}`}><Trash2 size={15} strokeWidth={1.7} aria-hidden="true" /></Button>
              </span>}
          </li>)}
        </ul>
      </section>
      <section aria-labelledby="plantillas-base">
        <h4 id="plantillas-base">De base de Plano · {base.length}</h4>
        <p className="muted text-sm">No se pueden borrar. Cópiala para adaptarla: la vuestra, con el mismo nombre, la sustituye.</p>
        <ul>
          {base.map(p => <li key={p.id}>
            <span><strong>{p.nombre}</strong><small>{p.subtareas.length} subtareas · {p.oficio}</small></span>
            <Button variant="ghost" onClick={() => copiar(p)} aria-label={`Copiar ${p.nombre} para adaptarla`}><Copy size={15} strokeWidth={1.7} aria-hidden="true" />Copiar y adaptar</Button>
          </li>)}
        </ul>
      </section>
    </div>
  </Modal>;
}
