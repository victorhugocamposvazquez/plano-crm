"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/ui/search-box";
import { OperarioCard } from "@/components/equipo/operario-card";
import { OperarioDialog } from "@/components/equipo/operario-dialog";
import { can, roleNames, type Operario } from "@/lib/domain";
import { haceOficio, oficiosPosibles } from "@/lib/operarios";
import { puestoNombres } from "@/lib/puestos";
import { normalizar } from "@/lib/busqueda";
import { iniciales } from "@/lib/pasos";

/**
 * Equipo: los operarios (con o sin cuenta en Plano: propios, autónomos, subcontratas) con su contacto, oficios y disponibilidad,
 * y las personas que entran en Plano con su puesto y permiso.
 */
export default function EquipoPage() {
  const { data, actor } = useWorkspace();
  const puede = can(actor.role, "operario.create");
  const [ficha, setFicha] = useState<{ operario: Operario | null } | null>(null);
  const [buscar, setBuscar] = useState("");
  const [oficio, setOficio] = useState("");
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const operarios = data.operarios ?? [];
  const oficios = useMemo(() => oficiosPosibles({ articles: [], operarios }), [operarios]);
  const lista = useMemo(() => operarios
    .filter(o => !soloDisponibles || o.available)
    .filter(o => !oficio || haceOficio(o, oficio))
    .filter(o => !buscar.trim() || normalizar(`${o.name} ${o.company} ${o.trades.join(" ")} ${o.phone}`).includes(normalizar(buscar.trim())))
    .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "es")), [operarios, soloDisponibles, oficio, buscar]);

  return <div className="page equipo-page">
    <div className="page-head">
      <div><h1 className="pl-title">Equipo</h1><p className="pl-sub">Quién trabaja en las obras y cómo localizarle. Los oficios son las categorías del catálogo: así cada actuación sabe quién la hace.</p></div>
      {puede && <Button variant="primary" onClick={() => setFicha({ operario: null })}><Plus size={16} strokeWidth={1.8} aria-hidden="true" />Nuevo operario</Button>}
    </div>

    <section aria-labelledby="equipo-operarios" className="equipo-seccion">
      <div className="equipo-seccion-cabeza">
        <h2 id="equipo-operarios">Operarios · {operarios.length}</h2>
        <span className="muted text-sm">{operarios.filter(o => o.available).length} disponibles</span>
      </div>
      {operarios.length > 0 && <>
        <SearchBox seccion="equipo" value={buscar} onChange={setBuscar} label="Buscar en el equipo" placeholder="Nombre, empresa, oficio o teléfono" count={`${lista.length} de ${operarios.length}`} />
        <div className="pl-seg equipo-filtros" role="group" aria-label="Filtrar por oficio">
          <button type="button" aria-pressed={!oficio} onClick={() => setOficio("")}>Todos</button>
          {oficios.map(t => <button key={t} type="button" aria-pressed={oficio === t} onClick={() => setOficio(oficio === t ? "" : t)}>{t}</button>)}
          <button type="button" aria-pressed={soloDisponibles} onClick={() => setSoloDisponibles(v => !v)}>Solo disponibles</button>
        </div>
      </>}
      {operarios.length === 0 && <div className="empty"><strong>Todavía no hay operarios</strong><p className="muted">Añade a quien trabaja en las obras: de plantilla, autónomos o subcontratas, con su teléfono y lo que hace. No hace falta que tengan cuenta en Plano.</p>{puede && <Button variant="primary" onClick={() => setFicha({ operario: null })}><Plus size={16} strokeWidth={1.8} aria-hidden="true" />Nuevo operario</Button>}</div>}
      {operarios.length > 0 && lista.length === 0 && <p className="muted text-sm">Nadie coincide con el filtro.</p>}
      <div className="operario-grid">
        {lista.map(o => <OperarioCard key={o.id} operario={o} cuenta={data.members.find(m => m.user_id === o.user_id)} onEditar={puede ? () => setFicha({ operario: o }) : undefined} />)}
      </div>
    </section>

    <section aria-labelledby="equipo-cuentas" className="equipo-seccion">
      <div className="equipo-seccion-cabeza"><h2 id="equipo-cuentas">Con cuenta en Plano · {data.members.length}</h2></div>
      <div className="pl-card equipo-cuentas">
        {[...data.members].sort((a, b) => a.display_name.localeCompare(b.display_name, "es")).map(m => <div key={m.user_id} className="equipo-cuenta">
          <span className="msg-avatar" aria-hidden="true">{iniciales(m.display_name)}</span>
          <span><strong>{m.display_name}</strong><small>{puestoNombres[m.position]} · {roleNames[m.role]}</small></span>
          {(data.operarios ?? []).some(o => o.user_id === m.user_id) && <span className="items-tag">También operario</span>}
        </div>)}
      </div>
      <p className="muted text-xs">Las cuentas, los puestos y los permisos se cambian en la administración de la empresa.</p>
    </section>

    <OperarioDialog open={Boolean(ficha)} operario={ficha?.operario ?? null} onClose={() => setFicha(null)} />
  </div>;
}
