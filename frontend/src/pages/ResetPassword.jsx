import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errMsg } from "../api/axios";
import { AuthShell } from "./Login";

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try { setDone((await api.post("/auth/reset-password", { token, password })).data.message); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <h2 className="font-display text-3xl text-ink mb-1">Choose a new password</h2>
      <p className="text-muted text-sm mb-8">Use at least 6 characters.</p>
      {done ? (
        <div role="status" className="rounded-md bg-success/10 border border-success/20 px-4 py-4 text-sm text-success">
          {done}
          <div className="mt-3"><Link to="/login" className="btn btn-primary">Go to sign in</Link></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="np" className="block text-xs font-semibold text-ink/70 tracking-wide uppercase mb-1.5">New password</label>
            <input id="np" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="cp" className="block text-xs font-semibold text-ink/70 tracking-wide uppercase mb-1.5">Confirm password</label>
            <input id="cp" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
          </div>
          {error && (
            <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 px-3.5 py-2.5 text-sm text-danger">
              {error} {/expired|invalid/i.test(error) && <Link to="/forgot-password" className="underline font-medium">Request a new link</Link>}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn btn-primary w-full !py-2.5">{busy ? "Saving…" : "Update password"}</button>
        </form>
      )}
    </AuthShell>
  );
};
export default ResetPassword;
