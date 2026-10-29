import { compareVersions, totals, type Budget, type BudgetVersion } from "./domain";

/** Una revisión cerrada anterior a la aprobada sigue siendo histórica, aunque conserve el estado issued. */
export function budgetHistory(budget: Pick<Budget,"id"|"approved_version_id">, all: BudgetVersion[]) {
  const versions=all.filter(v=>v.budget_id===budget.id).sort((a,b)=>b.number-a.number);
  const approved=versions.find(v=>v.id===budget.approved_version_id);
  const working=versions.find(v=>(v.status==="draft" || v.status==="issued") && (!approved || v.number>approved.number));
  return {versions,approved,working,current:working ?? approved ?? versions[0]};
}

export function versionLabel(version:BudgetVersion, history:ReturnType<typeof budgetHistory>) {
  if(version.id===history.approved?.id)return "Aprobada para obra";
  if(version.id===history.working?.id)return version.status==="draft"?"Borrador actual":"Terminada · pendiente de aprobar";
  if(version.status==="superseded" || version.status==="approved")return "Aprobación anterior";
  return version.status==="issued"?"Terminada · anterior":"Borrador anterior";
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
