import React, { useEffect } from "react";

export const Button = ({ variant = "primary", size, className = "", ...p }) => (
  <button type="button" className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`} {...p} />
);

export const Card = ({ title, action, children, className = "" }) => (
  <section className={`bg-white rounded-lg border border-slate-200 p-5 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4 gap-3">
        {title && <h2 className="font-display text-lg text-ink">{title}</h2>}
        {action}
      </div>
    )}
    {children}
  </section>
);

export const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-ink/70 tracking-wide uppercase mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
  </label>
);

export const Alert = ({ type = "error", children }) =>
  children ? (
    <div role={type === "error" ? "alert" : "status"} className={`rounded-md border px-3.5 py-2.5 text-sm ${type === "error" ? "bg-danger/10 border-danger/20 text-danger" : "bg-success/10 border-success/20 text-success"}`}>
      {children}
    </div>
  ) : null;

export const Modal = ({ open, title, onClose, children, wide = false }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 pt-16" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full bg-white rounded-lg shadow-xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink text-2xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div>
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

export const Spinner = () => (
  <div className="flex justify-center py-12" role="status" aria-label="Loading">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-gold" />
  </div>
);

// Shows spinner / error (with retry) / content
export const PageState = ({ loading, error, onRetry, children }) => {
  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="bg-white border border-danger/20 rounded-lg p-8 text-center">
        <p className="text-danger text-sm mb-3">{error}</p>
        {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    );
  return children;
};

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto" role="tablist">
    {tabs.map(([key, label]) => (
      <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}
        className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition ${value === key ? "border-gold text-ink font-medium" : "border-transparent text-muted hover:text-ink"}`}>
        {label}
      </button>
    ))}
  </div>
);

export const Select = ({ value, onChange, options, placeholder, className = "", ...p }) => (
  <select className={`input !w-auto ${className}`} value={value} onChange={(e) => onChange(e.target.value)} {...p}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o.replace(/_/g, " ")}</option>))}
  </select>
);
