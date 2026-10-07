import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState } from "../../components/ui";

const Staff = () => {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch("/auth/staff");
  const hostels = useFetch("/hostels");
  const [form, setForm] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const isSuper = user.role === "superadmin";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = (e) => {
    e.preventDefault();
    run(async () => { await api.post("/auth/create-staff", { ...form, hostel: form.hostel || undefined }); setForm(null); reload(); });
  };
  const toggle = (u) => run(async () => { await api.put(`/auth/staff/${u._id}`, { isActive: !u.isActive }); reload(); });

  return (
    <div>
      <PageHeader title="Staff" subtitle={isSuper ? "Wardens and security guards." : "Security guards for your hostel."}>
        <Button variant="gold" onClick={() => { setError(""); setForm({ name: "", email: "", password: "", phone: "", role: "security", hostel: "" }); }}>+ Add Staff</Button>
      </PageHeader>
      <Alert>{!form && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} columns={[
          { key: "name", label: "Name", render: (u) => (<div><p className="font-medium">{u.name}</p><p className="text-xs text-muted">{u.email}</p></div>) },
          { key: "role", label: "Role", render: (u) => <span className="capitalize">{u.role === "admin" ? "warden" : u.role}</span> },
          { key: "hostel", label: "Hostel", render: (u) => u.hostel?.name || (u.role === "superadmin" ? "All" : "—") },
          { key: "isActive", label: "Status", render: (u) => <Badge status={u.isActive ? "active" : "blocked"} /> },
          { key: "act", label: "", render: (u) => u._id !== user._id && u.role !== "superadmin" && (isSuper || u.role === "security") && (
            <Button size="sm" variant="outline" onClick={() => toggle(u)}>{u.isActive ? "Deactivate" : "Activate"}</Button>) },
        ]} />
      </PageState>

      <Modal open={!!form} title="Add staff member" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={create} className="space-y-4">
            <Field label="Full name"><input className="input" required value={form.name} onChange={set("name")} /></Field>
            <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set("email")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Password"><input className="input" type="text" required minLength={6} value={form.password} onChange={set("password")} /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={set("phone")} /></Field>
            </div>
            {isSuper && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Role"><select className="input" value={form.role} onChange={set("role")}><option value="security">Security guard</option><option value="admin">Warden (admin)</option></select></Field>
                <Field label="Hostel"><select className="input" value={form.hostel} onChange={set("hostel")}><option value="">— none —</option>{(hostels.data || []).map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}</select></Field>
              </div>
            )}
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Create account</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Staff;
