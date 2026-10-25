/** Marca «PLANO■» en interfaz. En el carril de tablet solo se ve la inicial. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`pl-brand ${className}`.trim()} aria-label="Plano">
      <span className="pl-brand-text" aria-hidden="true">PLANO</span>
      <span className="pl-brand-initial" aria-hidden="true">P</span>
    </span>
  );
}
