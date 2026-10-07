import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../utils/format";
import { AuthShell } from "./Login";

const Register = () => {
  const { user, register, loading, error, setError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (user) return <Navigate to={roleHome[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
      navigate("/student");
    } catch { /* shown from context */ }
  };

  return (
    <AuthShell>
      <h2 className="font-display text-3xl text-ink mb-1">Create account</h2>
      <p className="text-muted text-sm mb-8">After signing up, the hostel office will create your student profile and allocate a room.</p>
      <form onSubmit={submit} className="space-y-4">
        {[["name", "Full name", "text"], ["email", "Email", "email"], ["phone", "Phone (optional)", "tel"], ["password", "Password (min 6 characters)", "password"]].map(([k, label, type]) => (
          <div key={k}>
            <label htmlFor={k} className="block text-xs font-semibold text-ink/70 tracking-wide uppercase mb-1.5">{label}</label>
            <input id={k} type={type} required={k !== "phone"} minLength={k === "password" ? 6 : undefined} value={form[k]} onChange={set(k)} className="input" />
          </div>
        ))}
        {error && <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 px-3.5 py-2.5 text-sm text-danger">{error}</div>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full !py-2.5">{loading ? "Creating…" : "Create account"}</button>
      </form>
      <p className="text-center text-xs text-muted mt-8">
        Already registered? <Link to="/login" onClick={() => setError("")} className="text-ink font-medium hover:text-gold-dark">Sign in</Link>
      </p>
    </AuthShell>
  );
};
export default Register;
