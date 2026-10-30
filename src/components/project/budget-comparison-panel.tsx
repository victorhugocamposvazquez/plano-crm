"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import type { BudgetItemEdit, BudgetVersion } from "@/lib/domain";
import { BudgetComparison } from "./budget-comparison";

export function BudgetComparisonPanel({ before, after }: { before: BudgetVersion; after: BudgetVersion }) {
  const { data, mode } = useWorkspace();
  const [result, setResult] = useState<{ key: string; edits: BudgetItemEdit[]; status: "ready" | "unavailable" | "error" }>();
  const key = `${after.id}:${after.draft_revision}`;
  useEffect(() => {
    if (mode === "demo") return;
    const abort = new AbortController();
    fetch(`/api/budgets/${after.budget_id}/versions/${after.id}/changes?revision=${after.draft_revision}`, { cache: "no-store", signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error("No se ha podido consultar el registro.");
        const body = await response.json();
        setResult({ key, edits: body.edits, status: body.available ? "ready" : "unavailable" });
      }).catch(() => { if (!abort.signal.aborted) setResult({ key, edits: [], status: "error" }); });
    return () => abort.abort();
  }, [mode, key, after.id, after.budget_id, after.draft_revision]);
  const edits = mode === "demo" ? (data.budget_item_events ?? []).filter(edit => edit.version_id === after.id) : result?.key === key ? result.edits : [];
  const status = mode === "demo" ? "ready" : result?.key === key ? result.status : "loading";
  return <BudgetComparison before={before} after={after} edits={edits} editStatus={status}/>;
}
