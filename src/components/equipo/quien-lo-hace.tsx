"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { OperarioCard } from "@/components/equipo/operario-card";
import { OperarioDialog } from "@/components/equipo/operario-dialog";
import { can } from "@/lib/domain";
import { operariosDe } from "@/lib/operarios";

/** Operarios que hacen una categoría del catálogo (por ejemplo «Demoliciones»), con su contacto, y cómo añadir uno. */
export function QuienLoHace({ categoria, mensaje }: { categoria: string; mensaje?: string }) {
  const { data, actor } = useWorkspace();
  const [alta, setAlta] = useState(false);
  const lista = operariosDe(categoria, data.operarios ?? []);
  const puede = can(actor.role, "operario.create");
  return <section className="quien-lo-hace" aria-label={`Quién hace ${categoria}`}>
    <div className="quien-lo-hace-cabeza">
      <h3>Quién lo hace · {categoria}</h3>
      <Link prefetch={false} href="/equipo" className="text-sm">Equipo</Link>
    </div>
    {lista.length === 0 && <p className="muted text-sm" style={{ margin: 0 }}>Nadie del equipo tiene este oficio todavía.</p>}
    {lista.map(o => <OperarioCard key={o.id} operario={o} compacta mensaje={mensaje} />)}
    {puede && <button type="button" className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setAlta(true)}><Plus size={15} strokeWidth={1.7} aria-hidden="true" />Añadir operario de {categoria.toLocaleLowerCase()}</button>}
    <OperarioDialog open={alta} operario={null} oficio={categoria} onClose={() => setAlta(false)} />
  </section>;
}
