export type TabOption<T extends string> = { id: T; label: string; count?: number };

/** Pestañas de filtro: subrayado en Workspace, píldora en Grafito (ver ui.css). */
export function Tabs<T extends string>({ options, value, onChange, label }: { options: TabOption<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = Math.max(0, options.findIndex(option => option.id === value));
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
      const option = options[next]; if (!option) return;
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
      onChange(option.id);
    }}>
      {options.map(option => (
        <button key={option.id} type="button" role="tab" className="tab" aria-selected={option.id === value} tabIndex={option.id === value ? 0 : -1} onClick={() => onChange(option.id)}>
          {option.label}
          {option.count !== undefined && <small className="tab-count">{option.count}</small>}
        </button>
      ))}
    </div>
  );
}
