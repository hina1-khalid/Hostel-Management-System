export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthISO = () => new Date().toISOString().slice(0, 7);
export const nameOf = (s) => s?.user?.name || "—";
export const cap = (s) => (s || "").replace(/_/g, " ");
export const roleHome = { superadmin: "/admin", admin: "/admin", student: "/student", security: "/security" };
