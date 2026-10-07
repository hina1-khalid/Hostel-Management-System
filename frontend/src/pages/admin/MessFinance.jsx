import React, { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import ExportButton from "../../components/ExportButton";
import { Alert, Button, Card, Field, Modal, PageState, Select } from "../../components/ui";
import { fmtDate, fmtDateTime, money, monthISO, todayISO } from "../../utils/format";

const COLORS = ["#C9A227", "#16213E", "#2F855A", "#C0392B", "#64748B", "#B7791F", "#1F2E52", "#DDBE5C"];
const EXP_CATS = ["grocery", "vegetables", "meat", "dairy", "gas", "staff", "utilities", "repairs", "other"];
const STOCK_CATS = ["grocery", "vegetables", "meat", "dairy", "gas", "other"];
const UNITS = ["kg", "litre", "piece", "pack", "dozen"];
const q = (hostelId, extra = "") => `${hostelId ? `hostel=${hostelId}` : ""}${hostelId && extra ? "&" : ""}${extra}`;

// ---------------- Expenses ----------------
export const ExpensesTab = ({ hostelId }) => {
  const [month, setMonth] = useState(monthISO());
  const [category, setCategory] = useState("");
  const { data, loading, error, reload } = useFetch(`/mess-finance/expenses?${q(hostelId, `month=${month}${category ? `&category=${category}` : ""}`)}`);
  const [form, setForm] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    run(async () => { await api.post("/mess-finance/expenses", { hostel: hostelId || undefined, ...form, amount: Number(form.amount) }); setForm(null); reload(); });
  };
  const remove = (x) => window.confirm(`Delete "${x.description}"?`) && run(async () => { await api.delete(`/mess-finance/expenses/${x._id}`); reload(); });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="month" className="input !w-auto" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <Select value={category} onChange={setCategory} placeholder="All categories" options={EXP_CATS} aria-label="Category" />
        <div className="flex-1" />
        <ExportButton type="mess-expenses" params={{ hostel: hostelId, month }} />
        <Button variant="gold" disabled={!hostelId} onClick={() => { setError(""); setForm({ date: todayISO(), category: "grocery", description: "", amount: "", paidTo: "" }); }}>+ Add expense</Button>
      </div>
      {!hostelId && <p className="text-sm text-muted mb-3">Pick one hostel at the top to add expenses.</p>}
      <Alert>{!form && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && <div className="max-w-xs mb-4"><StatCard label={`Spent in ${month}`} value={money(data.total)} accent hint={`${data.items.length} entries`} /></div>}
        <DataTable rows={data?.items} emptyText="No expenses recorded for this month." columns={[
          { key: "date", label: "Date", render: (x) => fmtDate(x.date) },
          { key: "description", label: "What", render: (x) => (<div><p className="font-medium">{x.description}</p>{x.paidTo && <p className="text-xs text-muted">{x.paidTo}</p>}</div>) },
          { key: "category", label: "Category", render: (x) => <span className="capitalize">{x.category}</span> },
          { key: "source", label: "Source", render: (x) => (x.source === "manual" ? "Entered" : x.source === "stock" ? "Stock purchase" : "Salary") },
          { key: "amount", label: "Amount", render: (x) => <strong>{money(x.amount)}</strong> },
          { key: "act", label: "", render: (x) => x.source !== "payroll" && <Button size="sm" variant="outline" onClick={() => remove(x)}>Delete</Button> },
        ]} />
      </PageState>
      <Modal open={!!form} title="Add mess expense" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="What was bought / paid"><input className="input" required minLength={2} value={form.description} onChange={set("description")} placeholder="Rice 50 kg" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (Rs)"><input className="input" type="number" min="1" required value={form.amount} onChange={set("amount")} /></Field>
              <Field label="Date"><input className="input" type="date" required max={todayISO()} value={form.date} onChange={set("date")} /></Field>
              <Field label="Category"><select className="input" value={form.category} onChange={set("category")}>{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Paid to"><input className="input" value={form.paidTo} onChange={set("paidTo")} placeholder="Shop / vendor" /></Field>
            </div>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};

// ---------------- Stock ----------------
const MOVE_TITLES = { in: "Add stock", out: "Use stock", adjust: "Stock count" };

export const StockTab = ({ hostelId }) => {
  const { data, loading, error, reload } = useFetch(`/mess-finance/stock${hostelId ? `?hostel=${hostelId}` : ""}`);
  const [form, setForm] = useState(null);
  const [move, setMove] = useState(null);
  const [hist, setHist] = useState(null);
  const histData = useFetch(hist ? `/mess-finance/stock/${hist._id}/history` : null);
  const { run, busy, error: formError, setError } = useAction();
  const editing = form && form._id;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { name: form.name, category: form.category, unit: form.unit, minQuantity: Number(form.minQuantity) || 0 };
      editing ? await api.put(`/mess-finance/stock/${form._id}`, body) : await api.post("/mess-finance/stock", { ...body, hostel: hostelId || undefined, quantity: Number(form.quantity) || 0 });
      setForm(null); reload();
    });
  };
  const submitMove = (e) => {
    e.preventDefault();
    run(async () => { await api.post(`/mess-finance/stock/${move._id}/move`, { type: move.type, quantity: Number(move.quantity), cost: move.type === "in" ? Number(move.cost) || 0 : undefined, note: move.note || undefined }); setMove(null); reload(); });
  };
  const remove = (i) => window.confirm(`Delete ${i.name} and its history?`) && run(async () => { await api.delete(`/mess-finance/stock/${i._id}`); reload(); });
  const low = (data || []).filter((i) => i.low).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {low > 0 && <span role="status" className="text-sm text-warning font-medium">⚠ {low} item(s) at or below the alert level</span>}
        <div className="flex-1" />
        <Button variant="gold" disabled={!hostelId} onClick={() => { setError(""); setForm({ name: "", category: "grocery", unit: "kg", quantity: 0, minQuantity: 0 }); }}>+ Add item</Button>
      </div>
      {!hostelId && <p className="text-sm text-muted mb-3">Pick one hostel at the top to add items.</p>}
      <Alert>{!form && !move && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No stock items yet. Add rice, flour, oil, gas cylinders…" columns={[
          { key: "name", label: "Item", render: (i) => (<div><p className="font-medium">{i.name}</p><p className="text-xs text-muted capitalize">{i.category}{i.hostel?.code ? ` · ${i.hostel.code}` : ""}</p></div>) },
          { key: "quantity", label: "In stock", render: (i) => <strong>{i.quantity} {i.unit}</strong> },
          { key: "minQuantity", label: "Alert at", render: (i) => `${i.minQuantity} ${i.unit}` },
          { key: "low", label: "Level", render: (i) => (i.low ? <Badge status="high" /> : <Badge status="ok" />) },
          { key: "act", label: "", render: (i) => (
            <div className="flex gap-2 justify-end flex-wrap">
              <Button size="sm" variant="gold" onClick={() => { setError(""); setMove({ ...i, type: "in", quantity: "", cost: "", note: "" }); }}>+ In</Button>
              <Button size="sm" variant="outline" onClick={() => { setError(""); setMove({ ...i, type: "out", quantity: "", note: "" }); }}>Use</Button>
              <Button size="sm" variant="outline" onClick={() => { setError(""); setMove({ ...i, type: "adjust", quantity: i.quantity, note: "" }); }}>Count</Button>
              <Button size="sm" variant="outline" onClick={() => setHist(i)}>History</Button>
              <Button size="sm" variant="outline" onClick={() => { setError(""); setForm({ ...i }); }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => remove(i)}>Delete</Button>
            </div>) },
        ]} />
      </PageState>

      <Modal open={!!form} title={editing ? "Edit item" : "Add stock item"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Item"><input className="input" required minLength={2} value={form.name} onChange={set("name")} placeholder="Basmati rice" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><select className="input" value={form.category} onChange={set("category")}>{STOCK_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Unit"><select className="input" value={form.unit} onChange={set("unit")}>{UNITS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              {!editing && <Field label="Opening quantity"><input className="input" type="number" min="0" step="any" value={form.quantity} onChange={set("quantity")} /></Field>}
              <Field label="Alert when at or below" hint="You get a notification when stock falls to this level"><input className="input" type="number" min="0" step="any" value={form.minQuantity} onChange={set("minQuantity")} /></Field>
            </div>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!move} title={`${MOVE_TITLES[move?.type] || ""}: ${move?.name || ""}`} onClose={() => setMove(null)}>
        {move && (
          <form onSubmit={submitMove} className="space-y-4">
            <p className="text-sm text-muted">Now in stock: <strong>{move.type === "adjust" ? data?.find((i) => i._id === move._id)?.quantity ?? "" : move.quantity !== undefined && data?.find((i) => i._id === move._id)?.quantity}</strong> {move.unit}</p>
            <Field label={move.type === "adjust" ? `Counted quantity (${move.unit})` : `Quantity (${move.unit})`}>
              <input className="input" type="number" min={move.type === "adjust" ? 0 : 0.01} step="any" required value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} />
            </Field>
            {move.type === "in" && <Field label="Total cost paid (Rs)" hint="Optional. If you enter it, it is also recorded as a mess expense."><input className="input" type="number" min="0" value={move.cost} onChange={(e) => setMove({ ...move, cost: e.target.value })} /></Field>}
            <Field label="Note"><input className="input" value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} placeholder={move.type === "out" ? "e.g. Cooked this week" : ""} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMove(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!hist} title={`History: ${hist?.name || ""}`} onClose={() => setHist(null)}>
        <PageState loading={histData.loading} error={histData.error} onRetry={histData.reload}>
          {histData.data?.length === 0 ? <p className="text-sm text-muted">No movements yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {(histData.data || []).map((m) => (
                <li key={m._id} className="py-2.5 text-sm flex justify-between gap-3">
                  <span><Badge status={m.type === "in" ? "approved" : m.type === "out" ? "medium" : "low"} /> <strong className="ml-1">{m.type === "adjust" ? `set to ${m.quantity}` : `${m.type === "in" ? "+" : "−"}${m.quantity}`}</strong> {m.note && <span className="text-muted">· {m.note}</span>}</span>
                  <span className="text-xs text-muted whitespace-nowrap">→ {m.resultingQuantity} · {m.by?.name} · {fmtDateTime(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </PageState>
      </Modal>
    </div>
  );
};

// ---------------- Cost analysis ----------------
export const AnalysisTab = ({ hostelId }) => {
  const [month, setMonth] = useState(monthISO());
  const { data: a, loading, error, reload } = useFetch(`/mess-finance/analysis?${q(hostelId, `month=${month}`)}`);
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input type="month" className="input !w-auto" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <p className="text-xs text-muted">Spending includes manual expenses, stock purchases and paid mess-staff salaries.</p>
      </div>
      <PageState loading={loading} error={error} onRetry={reload}>
        {a && (
          <div className="space-y-4" data-testid="mess-analysis">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total spent" value={money(a.spent)} />
              <StatCard label="Meals served" value={a.mealsServed} hint="Booked + taken" />
              <StatCard label="Cost per meal" value={a.costPerMeal === null ? "—" : money(a.costPerMeal)} accent hint={a.avgBilledPerMeal === null ? "" : `Billed ${money(a.avgBilledPerMeal)} per meal`} />
              <StatCard label={a.profit >= 0 ? "Surplus" : "Loss"} value={money(Math.abs(a.profit))} hint={`Billed ${money(a.billed)} − spent ${money(a.spent)}`} />
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="Spent vs billed, last 6 months">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={a.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} />
                      <Tooltip formatter={(v) => money(v)} /><Legend />
                      <Bar dataKey="spent" name="Spent" fill="#C0392B" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="billed" name="Billed to students" fill="#2F855A" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Where the money went">
                <div className="h-64">
                  {a.byCategory.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={a.byCategory} dataKey="value" nameKey="name" outerRadius={85} label={(e) => e.name}>
                          {a.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => money(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="h-full flex items-center justify-center text-sm text-muted">No spending recorded this month.</p>}
                </div>
              </Card>
            </div>
            {a.billed === 0 && a.spent > 0 && <p className="text-sm text-warning">No mess bills have been generated for {month} yet, so the surplus/loss above compares spending with Rs 0. Generate them in the Bills tab.</p>}
          </div>
        )}
      </PageState>
    </div>
  );
};
