import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Alert, Button, Card, Field, PageHeader, PageState } from "../components/ui";

const Profile = () => {
  const { user, updateUser } = useAuth();
  const me = useFetch("/auth/me");
  const [form, setForm] = useState({ name: "", phone: "", emailNotifications: true });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [mailMsg, setMailMsg] = useState("");
  const save = useAction();
  const change = useAction();
  const mail = useAction();

  useEffect(() => {
    if (me.data) setForm({ name: me.data.name || "", phone: me.data.phone || "", emailNotifications: me.data.emailNotifications !== false });
  }, [me.data]);

  const saveProfile = (e) => {
    e.preventDefault();
    setMsg("");
    save.run(async () => {
      const { data } = await api.put("/auth/profile", form);
      updateUser({ name: data.name, phone: data.phone });
      setMsg("Profile saved.");
    });
  };

  const changePassword = (e) => {
    e.preventDefault();
    setPwMsg(""); setPwError("");
    if (pw.newPassword.length < 6) return setPwError("New password must be at least 6 characters");
    if (pw.newPassword !== pw.confirm) return setPwError("New passwords do not match");
    change.run(async () => {
      await api.put("/auth/change-password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setPwMsg("Password changed.");
    });
  };

  const testEmail = () => {
    setMailMsg("");
    mail.run(async () => { const { data } = await api.post("/notifications/test-email"); setMailMsg(data.message); });
  };

  return (
    <div>
      <PageHeader title="My Profile" subtitle={`${user.email} · ${user.role === "admin" ? "warden" : user.role}`} />
      <PageState loading={me.loading} error={me.error} onRetry={me.reload}>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Details & notifications">
            <form onSubmit={saveProfile} className="space-y-4">
              <Field label="Full name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1" checked={form.emailNotifications} onChange={(e) => setForm({ ...form, emailNotifications: e.target.checked })} />
                <span><span className="font-medium">Email me my notifications</span><span className="block text-xs text-muted">Fee dues, payments, leave decisions, complaint updates, notices and more. In-app notifications always stay on.</span></span>
              </label>
              <Alert>{save.error}</Alert>
              <Alert type="success">{msg}</Alert>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={save.busy}>{save.busy ? "Saving…" : "Save changes"}</Button>
                <Button variant="outline" onClick={testEmail} disabled={mail.busy}>{mail.busy ? "Sending…" : "Send me a test email"}</Button>
              </div>
              <Alert>{mail.error}</Alert>
              <Alert type="success">{mailMsg}</Alert>
            </form>
          </Card>
          <Card title="Change password">
            <form onSubmit={changePassword} className="space-y-4" autoComplete="off">
              <Field label="Current password"><input className="input" type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
              <Field label="New password" hint="At least 6 characters"><input className="input" type="password" required autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
              <Field label="Confirm new password"><input className="input" type="password" required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              <Alert>{pwError || change.error}</Alert>
              <Alert type="success">{pwMsg}</Alert>
              <Button type="submit" disabled={change.busy}>{change.busy ? "Updating…" : "Update password"}</Button>
            </form>
          </Card>
        </div>
      </PageState>
    </div>
  );
};
export default Profile;
