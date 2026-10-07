import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import Badge from "../../components/Badge";
import { Alert, Button, Card, Field, Modal, PageHeader, PageState } from "../../components/ui";
import PhotoGallery from "../../components/PhotoGallery";
import { compressImage, MAX_PHOTOS } from "../../utils/image";
import { fmtDateTime } from "../../utils/format";

const CATS = ["", "electricity", "water", "internet", "cleaning", "food", "furniture", "security", "other"];

const MyComplaints = () => {
  const { data, loading, error, reload } = useFetch("/complaints/me");
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(null);
  const [text, setText] = useState("");
  const { run, busy, error: formError, setError } = useAction();
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const current = data?.find((c) => c._id === open);

  const pickPhotos = async (e) => {
    const chosen = [...e.target.files];
    e.target.value = "";
    setPhotoError("");
    try {
      const room = MAX_PHOTOS - photos.length;
      if (chosen.length > room) setPhotoError(`You can attach at most ${MAX_PHOTOS} photos.`);
      const ready = await Promise.all(chosen.slice(0, Math.max(room, 0)).map((f) => compressImage(f)));
      setPhotos((p) => [...p, ...ready]);
    } catch (err) {
      setPhotoError(err.message);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description);
      if (form.category) body.append("category", form.category);
      photos.forEach((f) => body.append("photos", f));
      await api.post("/complaints", body);
      setForm(null); setPhotos([]); reload();
    });
  };
  const comment = (e) => {
    e.preventDefault();
    run(async () => { await api.post(`/complaints/${open}/comments`, { text }); setText(""); reload(); });
  };

  return (
    <div>
      <PageHeader title="My Complaints" subtitle="Report a problem — category and priority are detected automatically if you leave them blank.">
        <Button variant="gold" onClick={() => { setError(""); setPhotoError(""); setPhotos([]); setForm({ title: "", description: "", category: "" }); }}>+ New Complaint</Button>
      </PageHeader>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.length === 0 && <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-muted">You haven't filed any complaints.</div>}
        <div className="grid gap-3">
          {(data || []).map((c) => (
            <Card key={c._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-medium">{c.title}</h3><p className="text-sm text-muted line-clamp-2">{c.description}</p>
                  <p className="text-xs text-muted mt-1 capitalize">{c.category} · filed {fmtDateTime(c.createdAt)}{c.assignedTo ? ` · assigned to ${c.assignedTo.name}` : ""}{c.attachments?.length ? ` · 📷 ${c.attachments.length} photo${c.attachments.length > 1 ? "s" : ""}` : ""}</p></div>
                <div className="flex items-center gap-2"><Badge status={c.priority} /><Badge status={c.status} /><Button size="sm" variant="outline" onClick={() => { setError(""); setOpen(c._id); }}>{c.comments.length ? `Replies (${c.comments.length})` : "Open"}</Button></div>
              </div>
            </Card>
          ))}
        </div>
      </PageState>

      <Modal open={!!form} title="New complaint" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Title"><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fan not working" /></Field>
            <Field label="Describe the problem"><textarea className="input" rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Category (optional)"><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c || "Detect automatically"}</option>)}</select></Field>
            <Field label={`Photos (optional, up to ${MAX_PHOTOS})`} hint="Photos are shrunk automatically before uploading.">
              <input type="file" accept="image/*" multiple className="block w-full text-sm file:mr-3 file:btn file:btn-outline file:border file:cursor-pointer" aria-label="Add photos" disabled={photos.length >= MAX_PHOTOS} onChange={pickPhotos} />
            </Field>
            {photos.length > 0 && (
              <ul className="space-y-1">
                {photos.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm bg-paper rounded px-3 py-1.5">
                    <span className="truncate">📷 {f.name} <span className="text-xs text-muted">({Math.round(f.size / 1024)} KB)</span></span>
                    <button type="button" aria-label={`Remove ${f.name}`} className="text-muted hover:text-danger ml-3" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <Alert>{photoError || formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit"}</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!current} title={current?.title || ""} onClose={() => setOpen(null)}>
        {current && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{current.description}</p>
            <PhotoGallery ids={current.attachments} />
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {current.comments.length === 0 && <li className="text-sm text-muted">No replies yet.</li>}
              {current.comments.map((m) => <li key={m._id} className="bg-paper rounded-md px-3 py-2 text-sm"><span className="font-medium">{m.author?.name}</span> <span className="text-xs text-muted">· {fmtDateTime(m.createdAt)}</span><p>{m.text}</p></li>)}
            </ul>
            <form onSubmit={comment} className="flex gap-2"><input className="input" required value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" aria-label="Comment" /><Button type="submit" disabled={busy}>Send</Button></form>
            <Alert>{formError}</Alert>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default MyComplaints;
