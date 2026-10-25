export type TabOption<T extends string> = { id: T; label: string; count?: number };

/** Pestañas de filtro: subrayado en Workspace, píldora en Grafito (ver ui.css). */
export function Tabs<T extends string>({ options, value, onChange, label }: { options: TabOption<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map(option => (
        <button key={option.id} type="button" role="tab" className="tab" aria-selected={option.id === value} onClick={() => onChange(option.id)}>
          {option.label}
          {option.count !== undefined && <small className="tab-count">{option.count}</small>}
        </button>
      ))}
    </div>
  );
}
