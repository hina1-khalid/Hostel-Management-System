import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Card, PageHeader, PageState, Tabs } from "../../components/ui";
import { fmtDate, money, monthISO, todayISO } from "../../utils/format";

const MEALS = ["breakfast", "lunch", "dinner"];
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const MyMess = () => {
  const [tab, setTab] = useState("menu");
  const menu = useFetch("/mess/menu");
  const meals = useFetch(`/mess/meals/me?month=${monthISO()}`);
  const bills = useFetch("/mess/bills/me");
  const [fb, setFb] = useState({ meal: "lunch", rating: 5, comment: "" });
  const [msg, setMsg] = useState("");
  const { run, busy, error: actionError } = useAction();

  const status = (date, meal) => meals.data?.find((m) => m.date === date && m.meal === meal)?.status;
  const book = (date, meal, st) => run(async () => { await api.post("/mess/meals", { date, meal, status: st }); meals.reload(); });
  const sendFeedback = (e) => {
    e.preventDefault();
    run(async () => { await api.post("/mess/feedback", { ...fb, rating: Number(fb.rating), date: todayISO() }); setMsg("Thanks for your feedback!"); setFb({ ...fb, comment: "" }); });
  };

  return (
    <div>
      <PageHeader title="Mess" subtitle="Weekly menu, meal booking, feedback and bills." />
      <Tabs value={tab} onChange={setTab} tabs={[["menu", "Weekly menu"], ["book", "Book meals"], ["feedback", "Feedback"], ["bills", "My bills"]]} />
      <div className="space-y-3 mb-3"><Alert type="success">{msg}</Alert><Alert>{actionError}</Alert></div>

      {tab === "menu" && (
        <PageState loading={menu.loading} error={menu.error} onRetry={menu.reload}>
          <DataTable rows={menu.data?.days.map((d) => ({ ...d, _id: d.day }))} columns={[
            { key: "day", label: "Day", render: (d) => <span className="capitalize font-medium">{d.day}{menu.data.today === d.day && <span className="ml-2 text-[10px] text-gold-dark">TODAY</span>}</span> },
            ...MEALS.map((m) => ({ key: m, label: m, render: (d) => d[m] || "—" })),
          ]} />
        </PageState>
      )}

      {tab === "book" && (
        <PageState loading={meals.loading} error={meals.error} onRetry={meals.reload}>
          <p className="text-sm text-muted mb-3">Book the meals you will eat. You are billed for booked meals at month end, so cancel what you won't use.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map((n) => {
              const date = addDays(n);
              return (
                <Card key={date} title={n === 0 ? "Today" : n === 1 ? "Tomorrow" : fmtDate(date)}>
                  <ul className="space-y-3">
                    {MEALS.map((m) => {
                      const st = status(date, m);
                      const on = st === "booked" || st === "taken";
                      return (
                        <li key={m} className="flex items-center justify-between text-sm">
                          <span className="capitalize">{m}</span>
                          {st === "taken" ? <Badge status="taken" /> : (
                            <Button size="sm" variant={on ? "outline" : "gold"} disabled={busy} onClick={() => book(date, m, on ? "cancelled" : "booked")}>{on ? "Cancel" : "Book"}</Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>
        </PageState>
      )}

      {tab === "feedback" && (
        <Card title="How was today's meal?" className="max-w-lg">
          <form onSubmit={sendFeedback} className="space-y-4">
            <div className="flex gap-3">
              <select className="input" aria-label="Meal" value={fb.meal} onChange={(e) => setFb({ ...fb, meal: e.target.value })}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} role="radio" aria-checked={Number(fb.rating) === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setFb({ ...fb, rating: n })} className={`text-2xl leading-none ${n <= fb.rating ? "text-gold" : "text-slate-300"}`}>★</button>
                ))}
              </div>
            </div>
            <textarea className="input" rows={3} placeholder="Comments (optional)" value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} />
            <Button type="submit" disabled={busy}>Send feedback</Button>
          </form>
        </Card>
      )}

      {tab === "bills" && (
        <PageState loading={bills.loading} error={bills.error} onRetry={bills.reload}>
          <DataTable rows={bills.data} emptyText="No mess bills yet." columns={[
            { key: "month", label: "Month" }, { key: "mealsCount", label: "Meals" },
            { key: "ratePerMeal", label: "Rate", render: (b) => money(b.ratePerMeal) },
            { key: "amount", label: "Amount", render: (b) => <strong>{money(b.amount)}</strong> },
            { key: "status", label: "Status", render: (b) => <Badge status={b.status} /> },
          ]} />
        </PageState>
      )}
    </div>
  );
};
export default MyMess;
