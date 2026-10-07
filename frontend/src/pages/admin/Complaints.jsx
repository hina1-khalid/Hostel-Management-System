import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState, Select } from "../../components/ui";
import ExportButton from "../../components/ExportButton";
import PhotoGallery from "../../components/PhotoGallery";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import useDebounce from "../../hooks/useDebounce";
import { fmtDateTime, nameOf } from "../../utils/format";

const Complaints = () => {
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  useEffect(() => setPage(1), [dq, status, category, priority]);
  const params = new URLSearchParams({ limit: PAGE_SIZE, page });
  if (dq.trim()) params.set("q", dq.trim());
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  if (priority) params.set("priority", priority);
  const { data, total, loading, error, reload } = useFetch(`/complaints?${params}`);
  const staff = useFetch("/auth/staff");
  const [open, setOpen] = useState(null); // complaint id
  const [text, setText] = useState("");
  const { run, busy, error: formError, setError } = useAction();
  const current = data?.find((c) => c._id === open);

  const update = (patch) => run(async () => { await api.put(`/complaints/${open}`, patch); reload(); });
  const comment = (e) => {
    e.preventDefault();
    run(async () => { await api.post(`/complaints/${open}/comments`, { text }); setText(""); reload(); });
  };

  return (
    <div>
      <PageHeader title="Complaints" subtitle="Maintenance and service issues raised by students.">
        <input className="input !w-44" placeholder="Search title" aria-label="Search complaints" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={setStatus} placeholder="All statuses" options={["pending", "in_progress", "resolved", "rejected"]} />
        <Select value={category} onChange={setCategory} placeholder="All categories" options={["electricity", "water", "internet", "cleaning", "food", "furniture", "security", "other"]} />
        <Select value={priority} onChange={setPriority} placeholder="All priorities" options={["high", "medium", "low"]} />
        <ExportButton type="complaints" params={{ status, category, priority }} />
      </PageHeader>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No complaints. 🎉" columns={[
          { key: "title", label: "Complaint", render: (c) => (<div><p className="font-medium">{c.title}</p><p className="text-xs text-muted">{nameOf(c.student)} · Room {c.room?.roomNumber || "—"}</p></div>) },
          { key: "category", label: "Category", render: (c) => <span className="capitalize">{c.category}</span> },
          { key: "priority", label: "Priority", render: (c) => <Badge status={c.priority} /> },
          { key: "status", label: "Status", render: (c) => <Badge status={c.status} /> },
          { key: "assignedTo", label: "Assigned", render: (c) => c.assignedTo?.name || "—" },
          { key: "createdAt", label: "Filed", render: (c) => fmtDateTime(c.createdAt) },
          { key: "act", label: "", render: (c) => <Button size="sm" variant="outline" onClick={() => { setError(""); setOpen(c._id); }}>Open</Button> },
        ]} />
        <Pagination page={page} total={total} onChange={setPage} />
      </PageState>

      <Modal open={!!current} title="Complaint" onClose={() => setOpen(null)} wide>
        {current && (
          <div className="space-y-5">
            <div>
              <h3 className="font-medium text-ink">{current.title}</h3>
              <p className="text-sm text-muted mt-1">{current.description}</p>
              {current.attachments?.length > 0 && <div className="mt-3"><PhotoGallery ids={current.attachments} /></div>}
              <p className="text-xs text-muted mt-2">{nameOf(current.student)} · {current.hostel?.name} · Room {current.room?.roomNumber || "—"} · {fmtDateTime(current.createdAt)}</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Status"><select className="input" value={current.status} disabled={busy} onChange={(e) => update({ status: e.target.value })}>{["pending", "in_progress", "resolved", "rejected"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></Field>
              <Field label="Priority"><select className="input" value={current.priority} disabled={busy} onChange={(e) => update({ priority: e.target.value })}>{["high", "medium", "low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Assign to"><select className="input" value={current.assignedTo?._id || ""} disabled={busy} onChange={(e) => e.target.value && update({ assignedTo: e.target.value })}><option value="">Unassigned</option>{(staff.data || []).map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}</select></Field>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Conversation</h4>
              <ul className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {current.comments.length === 0 && <li className="text-sm text-muted">No comments yet.</li>}
                {current.comments.map((m) => (
                  <li key={m._id} className="bg-paper rounded-md px-3 py-2 text-sm"><span className="font-medium">{m.author?.name}</span> <span className="text-xs text-muted">· {fmtDateTime(m.createdAt)}</span><p>{m.text}</p></li>
                ))}
              </ul>
              <form onSubmit={comment} className="flex gap-2">
                <input className="input" required value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the student…" aria-label="Reply" />
                <Button type="submit" disabled={busy}>Send</Button>
              </form>
            </div>
            <Alert>{formError}</Alert>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default Complaints;
