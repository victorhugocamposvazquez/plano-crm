import { compareVersions, totals, type Budget, type BudgetVersion } from "./domain";

/** Una revisión cerrada anterior a la aprobada sigue siendo histórica, aunque conserve el estado issued. */
export function budgetHistory(budget: Pick<Budget,"id"|"approved_version_id">, all: BudgetVersion[]) {
  const versions=all.filter(v=>v.budget_id===budget.id).sort((a,b)=>b.number-a.number);
  const approved=versions.find(v=>v.id===budget.approved_version_id);
  const working=versions.find(v=>(v.status==="draft" || v.status==="issued") && (!approved || v.number>approved.number));
  return {versions,approved,working,current:working ?? approved ?? versions[0]};
}

export function versionLabel(version:BudgetVersion, history:ReturnType<typeof budgetHistory>) {
  if(version.id===history.approved?.id)return "Aceptado";
  if(version.id===history.working?.id)return version.status==="draft"?"Borrador":"Enviado";
  return "Archivada";
}

/** Fecha estable de creación; no se confunde con la última edición del borrador. */
export function versionTimestamp(value:string) {
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Madrid"}).format(date);
}

/** La aprobación la determina el presupuesto, no el color ni el estado histórico de una fila. */
export function versionState(version:BudgetVersion,approvedId:string|null|undefined) {
  if(version.id===approvedId)return "Aceptado";
  if(version.status==="draft")return "Borrador";
  if(version.status==="issued")return "Enviado";
  return "Archivada";
}

/** Una frase con lo que pasó con la versión; el estado solo no se lo explica a quien no lo vivió. */
export function versionSentence(version:BudgetVersion,history:ReturnType<typeof budgetHistory>) {
  const day=(value:string)=>new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",timeZone:"Europe/Madrid"}).format(new Date(value));
  if(version.id===history.approved?.id)return "Aceptada por el cliente. La obra se hace con esta.";
  if(version.id===history.working?.id)return version.status==="draft"?"La estás preparando. Todavía no la ha visto el cliente.":`Enviada al cliente el ${day(version.updated_at)}. No ha contestado.`;
  const next=[...history.versions].reverse().find(v=>v.number>version.number);
  if(version.status==="superseded" || version.status==="approved")return "Se aceptó y luego la sustituyó otra versión.";
  if(version.status==="issued")return next?`Se envió y luego se cambió por la V${next.number}.`:"Se envió y no llegó a aceptarse.";
  return "Borrador que no se llegó a enviar.";
}

/** Fecha corta que acompaña a cada versión: cuándo se aceptó, cuándo se envió o cuándo se tocó por última vez. */
export function versionMoment(version:BudgetVersion) {
  const day=new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",timeZone:"Europe/Madrid"});
  if(version.status==="approved" || version.status==="superseded")return `aceptado ${day.format(new Date(version.approved_at ?? version.updated_at))}`;
  if(version.status==="issued")return `enviado ${day.format(new Date(version.updated_at))}`;
  return `editado ${day.format(new Date(version.updated_at))}`;
}

/** El motivo explica la intención; las diferencias se calculan sobre las partidas y condiciones realmente guardadas. */
export function compareBudgetHistory(before:BudgetVersion,after:BudgetVersion) {
  if(before.budget_id!==after.budget_id)throw new Error("Solo se pueden comparar versiones del mismo presupuesto.");
  const changes=compareVersions(before,after),previous=totals(before.items),next=totals(after.items);
  const notesChanged=before.notes!==after.notes;
  return {before,after,changes,notesChanged,hasChanges:changes.length>0 || notesChanged,
    counts:{added:changes.filter(c=>c.kind==="added").length,removed:changes.filter(c=>c.kind==="removed").length,changed:changes.filter(c=>c.kind==="changed").length},
    previous,next,delta:{base:next.base-previous.base,tax:next.tax-previous.tax,total:next.total-previous.total}};
}

/** Subraya el bloque de texto cambiado y conserva el contexto común; no atribuye el cambio al motivo escrito. */
export function changedText(before:string,after:string) {
  const a=before.match(/\S+|\s+/g) ?? [],b=after.match(/\S+|\s+/g) ?? [];
  let start=0,end=0;
  while(start<a.length && start<b.length && a[start]===b[start])start++;
  while(end<a.length-start && end<b.length-start && a[a.length-1-end]===b[b.length-1-end])end++;
  return {prefix:a.slice(0,start).join(""),before:a.slice(start,a.length-end).join(""),after:b.slice(start,b.length-end).join(""),suffix:end?a.slice(a.length-end).join(""):""};
}
