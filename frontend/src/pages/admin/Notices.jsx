import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import Badge from "../../components/Badge";
import { Alert, Button, Card, Field, Modal, PageHeader, PageState } from "../../components/ui";
import { fmtDate } from "../../utils/format";

const blank = { title: "", content: "", category: "general", isPinned: false, expiresAt: "", hostel: "" };

const Notices = () => {
  const { data, loading, error, reload } = useFetch("/notices");
  const { hostels, locked } = useHostelPicker({ allowAll: true });
  const [form, setForm] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post("/notices", { ...form, hostel: form.hostel || undefined, expiresAt: form.expiresAt || undefined });
      setForm(null); reload();
    });
  };
  const togglePin = (n) => run(async () => { await api.put(`/notices/${n._id}`, { isPinned: !n.isPinned }); reload(); });
  const remove = (n) => window.confirm("Delete this notice?") && run(async () => { await api.delete(`/notices/${n._id}`); reload(); });

  return (
    <div>
      <PageHeader title="Notices" subtitle="Announcements shown to students. Posting one also sends a notification.">
        <Button variant="gold" onClick={() => { setError(""); setForm({ ...blank }); }}>+ New Notice</Button>
      </PageHeader>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.length === 0 && <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-muted">No notices yet.</div>}
        <div className="grid gap-4">
          {(data || []).map((n) => (
            <Card key={n._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {n.isPinned && <span title="Pinned">📌</span>}
                    <h3 className="font-display text-lg">{n.title}</h3>
                    <Badge status={n.category === "emergency" ? "high" : n.category === "general" ? "low" : "medium"} />
                    <span className="text-xs text-muted capitalize">{n.category}</span>
                  </div>
                  <p className="text-sm text-ink/80 whitespace-pre-wrap">{n.content}</p>
                  <p className="text-xs text-muted mt-2">By {n.postedBy?.name} · {fmtDate(n.createdAt)} · {n.hostel?.name || "All hostels"}{n.expiresAt ? ` · expires ${fmtDate(n.expiresAt)}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => togglePin(n)}>{n.isPinned ? "Unpin" : "Pin"}</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(n)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageState>

      <Modal open={!!form} title="New notice" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Title"><input className="input" required value={form.title} onChange={set("title")} /></Field>
            <Field label="Content"><textarea className="input" rows={4} required value={form.content} onChange={set("content")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><select className="input" value={form.category} onChange={set("category")}>{["general", "emergency", "holiday", "maintenance", "exam"].map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Expires on"><input className="input" type="date" value={form.expiresAt} onChange={set("expiresAt")} /></Field>
            </div>
            {!locked && (
              <Field label="Audience"><select className="input" value={form.hostel} onChange={set("hostel")}><option value="">All hostels</option>{hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}</select></Field>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} /> Pin to top</label>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Posting…" : "Post notice"}</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Notices;
