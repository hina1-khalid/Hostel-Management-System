import React, { useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api/axios";
import { AuthShell } from "./Login";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { setDone((await api.post("/auth/forgot-password", { email })).data.message); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <h2 className="font-display text-3xl text-ink mb-1">Forgot password</h2>
      <p className="text-muted text-sm mb-8">Enter your account email and we'll send you a link to choose a new password.</p>
      {done ? (
        <div role="status" className="rounded-md bg-success/10 border border-success/20 px-4 py-4 text-sm text-success">
          {done}
          <p className="text-xs text-ink/70 mt-2">The link works for 30 minutes. Check your spam folder if you don't see it.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="fp-email" className="block text-xs font-semibold text-ink/70 tracking-wide uppercase mb-1.5">Email</label>
            <input id="fp-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
          </div>
          {error && <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 px-3.5 py-2.5 text-sm text-danger">{error}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full !py-2.5">{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p className="text-center text-xs text-muted mt-8"><Link to="/login" className="text-ink font-medium hover:text-gold-dark">← Back to sign in</Link></p>
    </AuthShell>
  );
};
export default ForgotPassword;
