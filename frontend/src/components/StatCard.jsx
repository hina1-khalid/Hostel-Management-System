import React from "react";

const StatCard = ({ label, value, accent = false, hint }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-5">
    <p className="text-xs font-semibold text-muted tracking-wide uppercase mb-2">{label}</p>
    <p className={`font-display text-3xl ${accent ? "text-gold-dark" : "text-ink"}`}>{value}</p>
    {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
  </div>
);
export default StatCard;
