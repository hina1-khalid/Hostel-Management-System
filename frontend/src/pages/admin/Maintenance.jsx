import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import { Alert, Button, Field, Modal, PageHeader, PageState, Select } from "../../components/ui";
import { fmtDate, money, todayISO } from "../../utils/format";

const CATS = ["ac", "geyser", "water_tank", "pest_control", "electrical", "plumbing", "cleaning", "fire_safety", "generator", "other"];
const label = (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const dueText = (t) => (t.state === "paused" ? "Paused" : t.daysUntil < 0 ? `${-t.daysUntil} day(s) overdue` : t.daysUntil === 0 ? "Due today" : `In ${t.daysUntil} day(s)`);

const Maintenance = () => {
  const { hostelId, Picker, hostels, locked } = useHostelPicker({ allowAll: true });
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [showAll, setShowAll] = useState(false);
  const params = new URLSearchParams();
  if (hostelId) params.set("hostel", hostelId);
  if (category) params.set("category", category);
  if (state) params.set("state", state);
  if (showAll) params.set("all", "true");
  const { data, loading, error, reload } = useFetch(`/maintenance?${params}`);
  const summary = useFetch(`/maintenance/summary${hostelId ? `?hostel=${hostelId}` : ""}`);
  const [form, setForm] = useState(null);
  const [done, setDone] = useState(null);
  const [history, setHistory] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const refresh = () => { reload(); summary.reload(); };
  const editing = form && form._id;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const blank = () => ({ hostel: hostelId || hostels[0]?._id || "", title: "", category: "ac", intervalDays: 90, firstDueDate: "", assignedTo: "", estimatedCost: "", notes: "" });
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      if (editing) {
        await api.put(`/maintenance/${form._id}`, { title: form.title, category: form.category, intervalDays: Number(form.intervalDays), assignedTo: form.assignedTo, estimatedCost: Number(form.estimatedCost) || 0, notes: form.notes, nextDueDate: form.nextDueDate || undefined, isActive: form.isActive });
      } else {
        await api.post("/maintenance", { hostel: form.hostel || undefined, title: form.title, category: form.category, intervalDays: Number(form.intervalDays), firstDueDate: form.firstDueDate || undefined, assignedTo: form.assignedTo || undefined, estimatedCost: Number(form.estimatedCost) || 0, notes: form.notes || undefined });
      }
      setForm(null); refresh();
    });
  };
  const complete = (e) => {
    e.preventDefault();
    run(async () => { await api.post(`/maintenance/${done._id}/complete`, { doneDate: done.doneDate, cost: Number(done.cost) || 0, notes: done.notes || undefined }); setDone(null); refresh(); });
  };
  const remove = (t) => window.confirm(`Delete "${t.title}" and its history?`) && run(async () => { await api.delete(`/maintenance/${t._id}`); refresh(); });

  const s = summary.data;
  return (
    <div>
      <PageHeader title="Maintenance" subtitle="Repeating jobs such as AC service or tank cleaning. Wardens get a notification (and email) when one is due soon or overdue.">
        {Picker}
        <Select value={category} onChange={setCategory} placeholder="All categories" options={CATS.map((c) => [c, label(c)])} aria-label="Category" />
        <Select value={state} onChange={setState} placeholder="Any status" options={[["overdue", "Overdue"], ["due_soon", "Due soon"], ["ok", "On schedule"]]} aria-label="Status" />
        <Button variant="gold" onClick={() => { setError(""); setForm(blank()); }}>+ Add job</Button>
      </PageHeader>
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active jobs" value={s.total} />
          <StatCard label="Overdue" value={s.overdue} accent={s.overdue > 0} />
          <StatCard label="Due within 7 days" value={s.dueSoon} />
          <StatCard label="On schedule" value={s.ok} />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show paused jobs too</label>
      <Alert>{!form && !done && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No maintenance jobs yet. Add your first one, e.g. “Service all ACs” every 90 days." columns={[
          { key: "title", label: "Job", render: (t) => (<div><p className="font-medium">{t.title}</p><p className="text-xs text-muted">{label(t.category)} · every {t.intervalDays} days{t.assignedTo ? ` · ${t.assignedTo}` : ""}</p></div>) },
          { key: "hostel", label: "Hostel", render: (t) => t.hostel?.code },
          { key: "lastDoneAt", label: "Last done", render: (t) => fmtDate(t.lastDoneAt) },
          { key: "dueDate", label: "Next due", render: (t) => (<div><p>{fmtDate(t.dueDate)}</p><p className="text-xs text-muted">{dueText(t)}</p></div>) },
          { key: "state", label: "Status", render: (t) => <Badge status={t.state} /> },
          { key: "act", label: "", render: (t) => (
            <div className="flex gap-2 justify-end flex-wrap">
              <Button size="sm" variant="gold" onClick={() => { setError(""); setDone({ ...t, doneDate: todayISO(), cost: t.estimatedCost || "", notes: "" }); }}>Mark done</Button>
              <Button size="sm" variant="outline" onClick={() => setHistory(t)}>History ({t.history.length})</Button>
              <Button size="sm" variant="outline" onClick={() => { setError(""); setForm({ ...t, nextDueDate: t.dueDate }); }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => remove(t)}>Delete</Button>
            </div>) },
        ]} />
      </PageState>

      <Modal open={!!form} title={editing ? "Edit job" : "Add maintenance job"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            {!editing && !locked && <Field label="Hostel"><select className="input" required value={form.hostel} onChange={set("hostel")}>{hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}</select></Field>}
            <Field label="Job"><input className="input" required minLength={3} value={form.title} onChange={set("title")} placeholder="Service all ACs" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><select className="input" value={form.category} onChange={set("category")}>{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
              <Field label="Repeat every (days)"><input className="input" type="number" min="1" max="730" required value={form.intervalDays} onChange={set("intervalDays")} /></Field>
              <Field label={editing ? "Next due date" : "First due date"} hint={editing ? "" : "Leave empty to start counting from today"}><input className="input" type="date" value={(editing ? form.nextDueDate : form.firstDueDate) || ""} onChange={set(editing ? "nextDueDate" : "firstDueDate")} /></Field>
              <Field label="Estimated cost (Rs)"><input className="input" type="number" min="0" value={form.estimatedCost} onChange={set("estimatedCost")} /></Field>
            </div>
            <Field label="Person / vendor"><input className="input" value={form.assignedTo || ""} onChange={set("assignedTo")} placeholder="CoolTech Services" /></Field>
            <Field label="Notes"><input className="input" value={form.notes || ""} onChange={set("notes")} /></Field>
            {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive !== false} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (untick to pause reminders)</label>}
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!done} title={`Mark done: ${done?.title || ""}`} onClose={() => setDone(null)}>
        {done && (
          <form onSubmit={complete} className="space-y-4">
            <p className="text-sm text-muted">The next date is set automatically to {done.intervalDays} days after the date you enter.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Done on"><input className="input" type="date" required max={todayISO()} value={done.doneDate} onChange={(e) => setDone({ ...done, doneDate: e.target.value })} /></Field>
              <Field label="Actual cost (Rs)"><input className="input" type="number" min="0" value={done.cost} onChange={(e) => setDone({ ...done, cost: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><input className="input" value={done.notes} onChange={(e) => setDone({ ...done, notes: e.target.value })} placeholder="What was done" /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDone(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!history} title={`History: ${history?.title || ""}`} onClose={() => setHistory(null)}>
        {history && (history.history.length === 0 ? <p className="text-sm text-muted">Not done yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {[...history.history].reverse().map((h, i) => (
              <li key={i} className="py-2.5 text-sm"><span className="font-medium">{fmtDate(h.doneAt)}</span> · {money(h.cost)} · {h.doneBy?.name || "—"}{h.notes && <span className="block text-muted">{h.notes}</span>}</li>
            ))}
          </ul>
        ))}
      </Modal>
    </div>
  );
};
export default Maintenance;
