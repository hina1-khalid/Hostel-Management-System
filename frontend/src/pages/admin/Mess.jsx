import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import { Alert, Button, Card, PageHeader, PageState, Select, Tabs } from "../../components/ui";
import ExportButton from "../../components/ExportButton";
import { AnalysisTab, ExpensesTab, StockTab } from "./MessFinance";
import { fmtDate, money, monthISO, nameOf, todayISO } from "../../utils/format";

const MEALS = ["breakfast", "lunch", "dinner"];

const MenuTab = ({ hostelId }) => {
  const { data, loading, error, reload } = useFetch(hostelId ? `/mess/menu?hostel=${hostelId}` : null);
  const [days, setDays] = useState([]);
  const [msg, setMsg] = useState("");
  const { run, busy, error: saveError } = useAction();
  useEffect(() => { if (data) setDays(data.days.map((d) => ({ ...d }))); }, [data]);
  const edit = (i, k, v) => setDays(days.map((d, idx) => (idx === i ? { ...d, [k]: v } : d)));
  const saveDay = (d) => run(async () => {
    await api.put("/mess/menu", { hostel: hostelId, day: d.day, breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner });
    setMsg(`${d.day} saved`); reload();
  });
  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-3 mb-3"><Alert type="success">{msg}</Alert><Alert>{saveError}</Alert></div>
      <div className="grid gap-3">
        {days.map((d, i) => (
          <Card key={d.day}>
            <div className="grid md:grid-cols-[110px_1fr_1fr_1fr_auto] gap-3 items-center">
              <p className="font-display capitalize">{d.day}{data?.today === d.day && <span className="ml-2 text-[10px] text-gold-dark font-sans">TODAY</span>}</p>
              {MEALS.map((m) => <input key={m} className="input" aria-label={`${d.day} ${m}`} placeholder={m} value={d[m] || ""} onChange={(e) => edit(i, m, e.target.value)} />)}
              <Button size="sm" disabled={busy} onClick={() => saveDay(d)}>Save</Button>
            </div>
          </Card>
        ))}
      </div>
    </PageState>
  );
};

const RosterTab = ({ hostelId }) => {
  const [date, setDate] = useState(todayISO());
  const { data, loading, error, reload } = useFetch(`/mess/meals?date=${date}${hostelId ? `&hostel=${hostelId}` : ""}`);
  const { run, error: actionError } = useAction();
  const markAll = () => run(async () => { await api.put("/mess/meals/taken", { ids: data.records.filter((r) => r.status === "booked").map((r) => r._id) }); reload(); });
  const pending = (data?.records || []).filter((r) => r.status === "booked").length;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" className="input !w-auto" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant="outline" disabled={!pending} onClick={markAll}>Mark {pending} booked as taken</Button>
      </div>
      <Alert>{actionError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">{MEALS.map((m) => <StatCard key={m} label={`${m} booked`} value={data.counts[m]} />)}</div>
            <DataTable rows={data.records} emptyText="No meals booked for this date." columns={[
              { key: "student", label: "Student", render: (r) => nameOf(r.student) },
              { key: "reg", label: "Reg. No.", render: (r) => r.student?.registrationNumber },
              { key: "meal", label: "Meal", render: (r) => <span className="capitalize">{r.meal}</span> },
              { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
            ]} />
          </>
        )}
      </PageState>
    </div>
  );
};

const FeedbackTab = ({ hostelId }) => {
  const { data, loading, error, reload } = useFetch(`/mess/feedback${hostelId ? `?hostel=${hostelId}` : ""}`);
  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Overall rating" value={data.count ? `${data.average} / 5` : "—"} accent hint={`${data.count} reviews`} />
            {data.byMeal.map((m) => <StatCard key={m.meal} label={m.meal} value={m.count ? `${m.average} / 5` : "—"} hint={`${m.count} reviews`} />)}
          </div>
          <DataTable rows={data.items} emptyText="No feedback yet." columns={[
            { key: "date", label: "Date", render: (f) => fmtDate(f.date) },
            { key: "meal", label: "Meal", render: (f) => <span className="capitalize">{f.meal}</span> },
            { key: "rating", label: "Rating", render: (f) => <span aria-label={`${f.rating} out of 5`} className="text-gold-dark">{"★".repeat(f.rating)}<span className="text-slate-300">{"★".repeat(5 - f.rating)}</span></span> },
            { key: "comment", label: "Comment", render: (f) => f.comment || "—" },
            { key: "student", label: "Student", render: (f) => nameOf(f.student) },
          ]} />
        </>
      )}
    </PageState>
  );
};

const BillsTab = ({ hostelId }) => {
  const [month, setMonth] = useState(monthISO());
  const [rate, setRate] = useState(150);
  const [status, setStatus] = useState("");
  const [info, setInfo] = useState("");
  const params = new URLSearchParams();
  if (hostelId) params.set("hostel", hostelId);
  if (status) params.set("status", status);
  const { data, loading, error, reload } = useFetch(`/mess/bills?${params}`);
  const { run, busy, error: actionError } = useAction();
  const generate = () => run(async () => { const { data: r } = await api.post("/mess/bills/generate", { hostel: hostelId || undefined, month, ratePerMeal: Number(rate) }); setInfo(r.message); reload(); });
  const pay = (b) => run(async () => { await api.post(`/mess/bills/${b._id}/pay`); reload(); });
  return (
    <div>
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink/70">Month<input className="input mt-1.5" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink/70">Rate per meal (Rs)<input className="input mt-1.5" type="number" min="1" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
          <Button variant="gold" disabled={busy || !hostelId} onClick={generate}>Generate bills</Button>
          <Select value={status} onChange={setStatus} placeholder="All bills" options={["pending", "paid"]} />
          <ExportButton type="mess-bills" params={{ hostel: hostelId, status }} />
        </div>
        <p className="text-xs text-muted mt-2">Bills = booked/taken meals × rate. Re-running updates unpaid bills for the month.</p>
      </Card>
      <div className="space-y-3 mb-3"><Alert type="success">{info}</Alert><Alert>{actionError}</Alert></div>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No mess bills yet." columns={[
          { key: "student", label: "Student", render: (b) => nameOf(b.student) },
          { key: "month", label: "Month" },
          { key: "mealsCount", label: "Meals" },
          { key: "ratePerMeal", label: "Rate", render: (b) => money(b.ratePerMeal) },
          { key: "amount", label: "Amount", render: (b) => <strong>{money(b.amount)}</strong> },
          { key: "status", label: "Status", render: (b) => <Badge status={b.status} /> },
          { key: "act", label: "", render: (b) => b.status === "pending" && <Button size="sm" variant="gold" onClick={() => pay(b)}>Mark paid</Button> },
        ]} />
      </PageState>
    </div>
  );
};

const Mess = () => {
  const { hostelId, Picker } = useHostelPicker();
  const [tab, setTab] = useState("menu");
  return (
    <div>
      <PageHeader title="Mess" subtitle="Weekly menu, meal bookings, feedback and monthly bills.">{Picker}</PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[["menu", "Weekly menu"], ["roster", "Meal roster"], ["feedback", "Feedback"], ["bills", "Bills"], ["expenses", "Expenses"], ["stock", "Stock"], ["analysis", "Cost analysis"]]} />
      {tab === "menu" && <MenuTab hostelId={hostelId} />}
      {tab === "roster" && <RosterTab hostelId={hostelId} />}
      {tab === "feedback" && <FeedbackTab hostelId={hostelId} />}
      {tab === "bills" && <BillsTab hostelId={hostelId} />}
      {tab === "expenses" && <ExpensesTab hostelId={hostelId} />}
      {tab === "stock" && <StockTab hostelId={hostelId} />}
      {tab === "analysis" && <AnalysisTab hostelId={hostelId} />}
    </div>
  );
};
export default Mess;
