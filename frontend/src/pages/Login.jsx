import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../utils/format";
import Seal from "../components/Seal";

export const AuthShell = ({ children }) => (
  <div className="min-h-screen flex">
    <div className="hidden lg:flex lg:w-1/2 bg-ink relative overflow-hidden flex-col justify-between p-12">
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
      <div className="relative z-10 flex items-center gap-3">
        <Seal />
        <span className="font-display text-lg text-white tracking-wide">Hostel Management System</span>
      </div>
      <div className="relative z-10 max-w-md">
        <h1 className="font-display text-5xl text-white leading-tight mb-6">Every room,<br />every record,<br />in one place.</h1>
        <p className="text-white/60 text-sm leading-relaxed">Rooms, fees, mess, laundry, complaints and entry logs — managed digitally for administrators, students and security staff.</p>
      </div>
      <div className="relative z-10 text-white/40 text-xs font-mono tracking-wide">DIGITAL CAMPUS RESIDENCE PLATFORM</div>
    </div>
    <div className="flex-1 flex items-center justify-center px-6 py-12 bg-paper">
      <div className="w-full max-w-sm">
        <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
          <Seal small />
          <span className="font-display text-lg text-ink">Hostel Management System</span>
        </div>
        {children}
      </div>
    </div>
  </div>
);

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { user, login, loading, error, setError } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to={roleHome[user.role] || "/student"} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(email, password);
      navigate(roleHome[data.role] || "/student");
    } catch { /* message is shown from context */ }
  };

  return (
    <AuthShell>
      <h2 className="font-display text-3xl text-ink mb-1">Sign in</h2>
      <p className="text-muted text-sm mb-8">Enter your credentials to access your dashboard.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-ink/70 tracking-wide uppercase mb-1.5">Email</label>
          <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-ink/70 tracking-wide uppercase">Password</label>
            <Link to="/forgot-password" onClick={() => setError("")} className="text-xs text-gold-dark hover:underline">Forgot password?</Link>
          </div>
          <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" />
        </div>
        {error && <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 px-3.5 py-2.5 text-sm text-danger">{error}</div>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full !py-2.5">{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="text-center text-xs text-muted mt-8">
        New student?{" "}
        <Link to="/register" onClick={() => setError("")} className="text-ink font-medium hover:text-gold-dark">Create an account</Link>
      </p>
    </AuthShell>
  );
};
export default Login;
