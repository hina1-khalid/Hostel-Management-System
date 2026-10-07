import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const groups = [["students", "Students"], ["rooms", "Rooms"], ["complaints", "Complaints"], ["hostels", "Hostels"]];

const GlobalSearch = () => {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(async () => {
      try { setRes((await api.get("/search", { params: { q: q.trim() } })).data); setOpen(true); } catch { setRes(null); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const total = res ? groups.reduce((a, [k]) => a + (res[k]?.length || 0), 0) : 0;
  return (
    <div className="relative w-full max-w-xs" ref={ref}>
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => res && setOpen(true)} placeholder="Search students, rooms, complaints…" aria-label="Global search" className="input !py-2" />
      {open && res && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-40 max-h-96 overflow-y-auto">
          {total === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No results for “{q}”.</p>}
          {groups.map(([key, label]) => res[key]?.length > 0 && (
            <div key={key}>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
              {res[key].map((r) => (
                <button key={r.id} onClick={() => { setOpen(false); setQ(""); navigate(r.link); }} className="w-full text-left px-4 py-2 hover:bg-slate-50">
                  <span className="block text-sm text-ink">{r.title}</span>
                  <span className="block text-xs text-muted">{r.subtitle}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default GlobalSearch;
