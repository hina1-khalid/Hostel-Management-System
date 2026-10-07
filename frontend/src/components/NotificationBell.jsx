import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { fmtDateTime } from "../utils/format";

const dot = { info: "bg-slate-400", success: "bg-success", warning: "bg-warning", alert: "bg-danger" };

const NotificationBell = () => {
  const [state, setState] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try { setState((await api.get("/notifications")).data); } catch { /* silent: bell must never break the page */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = async (n) => {
    if (!n.isRead) await api.put(`/notifications/${n._id}/read`).catch(() => {});
    setOpen(false);
    load();
    if (n.link) navigate(n.link);
  };
  const readAll = async () => { await api.put("/notifications/read-all").catch(() => {}); load(); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${state.unread} unread`} className="relative p-2 rounded-md hover:bg-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>
        {state.unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-semibold flex items-center justify-center px-1">{state.unread > 9 ? "9+" : state.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-lg shadow-xl z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-medium text-sm">Notifications</span>
            {state.unread > 0 && <button onClick={readAll} className="text-xs text-gold-dark hover:underline">Mark all read</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {state.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You're all caught up.</li>}
            {state.items.map((n) => (
              <li key={n._id}>
                <button onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex gap-3 ${n.isRead ? "opacity-60" : ""}`}>
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot[n.type] || dot.info}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{n.title}</span>
                    <span className="block text-xs text-muted line-clamp-2">{n.message}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">{fmtDateTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
export default NotificationBell;
