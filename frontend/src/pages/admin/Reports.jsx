import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import StatCard from "../../components/StatCard";
import { Alert, Button, Card, PageHeader, PageState } from "../../components/ui";
import { fmtDate, money } from "../../utils/format";

const prevMonthISO = () => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const monthLabel = (m) => new Date(`${m}-15`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

// "▲ 5.0" style change vs previous month. goodWhenUp=false for things where lower is better.
const Trend = ({ cur, prev, unit = "", goodWhenUp = true, hide }) => {
  if (hide || prev === null || prev === undefined || cur === null || cur === undefined) return <span className="text-muted">—</span>;
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return <span className="text-muted">no change</span>;
  const good = (d > 0) === goodWhenUp;
  return <span className={good ? "text-success" : "text-danger"}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}{unit}</span>;
};

const List = ({ title, items, tone }) => {
  if (!items?.length) return null;
  const dot = { good: "bg-success", warn: "bg-warning", act: "bg-ink" }[tone];
  return (
    <Card title={title}>
      <ul className="space-y-2.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-3 text-sm text-ink/90">
            {tone === "act" ? <span className="shrink-0 h-5 w-5 rounded-full bg-ink text-white text-[11px] flex items-center justify-center mt-0.5">{i + 1}</span> : <span className={`shrink-0 h-2 w-2 rounded-full mt-2 ${dot}`} />}
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const Reports = () => {
  const { hostelId, Picker, locked } = useHostelPicker({ allowAll: true });
  const [month, setMonth] = useState(prevMonthISO());
  const [report, setReport] = useState(null);
  const history = useFetch("/reports");
  const gen = useAction();
  const open = useAction();

  useEffect(() => { if (history.data?.length && !report) openReport(history.data[0]._id); }, [history.data]); // eslint-disable-line

  const openReport = (id) => open.run(async () => { setReport((await api.get(`/reports/${id}`)).data); });
  const generate = () => gen.run(async () => {
    const { data } = await api.post("/reports/generate", { month, hostel: locked ? undefined : hostelId || undefined });
    setReport(data);
    history.reload();
  });

  const s = report?.stats, p = report?.previous;
  return (
    <div>
      <PageHeader title="Monthly Report" subtitle="A management summary of one month. Written by AI when an API key is configured, otherwise generated from built-in rules.">
        <span className="print:hidden flex flex-wrap items-center gap-2">
          {Picker}
          <input type="month" className="input !w-auto" aria-label="Report month" value={month} max={new Date().toISOString().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <Button variant="gold" onClick={generate} disabled={gen.busy}>{gen.busy ? "Generating…" : "Generate report"}</Button>
        </span>
      </PageHeader>
      <div className="mb-4 print:hidden"><Alert>{gen.error || open.error}</Alert></div>

      <div className="grid lg:grid-cols-[1fr_220px] gap-6">
        <div className="min-w-0">
          {!report && !history.loading && <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-muted">Pick a month and press <strong>Generate report</strong>.</div>}
          {report && (
            <div className="space-y-4" data-testid="report">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-display text-2xl">{monthLabel(report.month)}</h3>
                  <p className="text-sm text-muted">{report.hostelName} · generated {fmtDate(report.updatedAt)} · <span className={report.source === "claude" ? "text-gold-dark font-medium" : ""}>{report.source === "claude" ? "✦ AI-written" : "Auto-generated summary"}</span></p>
                </div>
                <Button variant="outline" className="print:hidden" onClick={() => window.print()}>🖨 Print / Save as PDF</Button>
              </div>

              <Card><p className="text-[15px] leading-relaxed text-ink/90">{report.narrative.summary}</p></Card>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Occupancy" value={`${s.occupancy.rate}%`} hint={`${s.occupancy.occupiedBeds}/${s.occupancy.totalBeds} beds`} accent />
                <StatCard label="Fee collection" value={s.fees.count ? `${s.fees.collectionRate}%` : "—"} hint={s.fees.count ? `${money(s.fees.collected)} of ${money(s.fees.billed)}` : "No fees due this month"} />
                <StatCard label="Complaints" value={s.complaints.total} hint={`${s.complaints.resolved} resolved · ${s.complaints.open} open`} />
                <StatCard label="Attendance" value={s.attendance.records ? `${s.attendance.presentRate}%` : "—"} hint={`${s.attendance.records} records`} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <List title="Highlights" items={report.narrative.highlights} tone="good" />
                <List title="Needs attention" items={report.narrative.concerns} tone="warn" />
              </div>
              <List title="Recommended actions" items={report.narrative.recommendations} tone="act" />

              <Card title="Key numbers vs previous month">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-slate-200"><th className="py-2 pr-4 font-semibold">Measure</th><th className="py-2 pr-4 font-semibold">This month</th><th className="py-2 pr-4 font-semibold">Last month</th><th className="py-2 font-semibold">Change</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ["Occupancy rate", `${s.occupancy.rate}%`, `${p.occupancy.rate}%`, <Trend cur={s.occupancy.rate} prev={p.occupancy.rate} unit=" pts" />],
                        ["Fees collected", money(s.fees.collected), money(p.fees.collected), <Trend cur={s.fees.collected} prev={p.fees.collected} />],
                        ["Collection rate", s.fees.count ? `${s.fees.collectionRate}%` : "—", p.fees.count ? `${p.fees.collectionRate}%` : "—", <Trend cur={s.fees.collectionRate} prev={p.fees.collectionRate} unit=" pts" hide={!s.fees.count || !p.fees.count} />],
                        ["Complaints filed", s.complaints.total, p.complaints.total, <Trend cur={s.complaints.total} prev={p.complaints.total} goodWhenUp={false} />],
                        ["Avg. resolution (hours)", s.complaints.avgResolutionHours ?? "—", p.complaints.avgResolutionHours ?? "—", <Trend cur={s.complaints.avgResolutionHours} prev={p.complaints.avgResolutionHours} goodWhenUp={false} />],
                        ["Attendance rate", s.attendance.records ? `${s.attendance.presentRate}%` : "—", p.attendance.records ? `${p.attendance.presentRate}%` : "—", <Trend cur={s.attendance.presentRate} prev={p.attendance.presentRate} unit=" pts" hide={!s.attendance.records || !p.attendance.records} />],
                        ["Late entries", s.gate.lateEntries, p.gate.lateEntries, <Trend cur={s.gate.lateEntries} prev={p.gate.lateEntries} goodWhenUp={false} />],
                        ["Visitors", s.gate.visitors, p.gate.visitors, <Trend cur={s.gate.visitors} prev={p.gate.visitors} />],
                        ["Leave requests", s.leaves.total, p.leaves.total, <Trend cur={s.leaves.total} prev={p.leaves.total} />],
                        ["Mess rating (of 5)", s.mess.rating.average ?? "—", p.mess.rating.average ?? "—", <Trend cur={s.mess.rating.average} prev={p.mess.rating.average} />],
                        ["Meals booked", s.mess.mealsBooked, p.mess.mealsBooked, <Trend cur={s.mess.mealsBooked} prev={p.mess.mealsBooked} />],
                        ...(s.ops && p.ops ? [
                          ["Mess spending", money(s.ops.mess.spent), money(p.ops.mess.spent), <Trend cur={s.ops.mess.spent} prev={p.ops.mess.spent} goodWhenUp={false} />],
                          ["Mess cost per meal", s.ops.mess.costPerMeal ?? "—", p.ops.mess.costPerMeal ?? "—", <Trend cur={s.ops.mess.costPerMeal} prev={p.ops.mess.costPerMeal} goodWhenUp={false} />],
                          ["Maintenance jobs done", s.ops.maintenance.completed, p.ops.maintenance.completed, <Trend cur={s.ops.maintenance.completed} prev={p.ops.maintenance.completed} />],
                          ["Salaries paid", money(s.ops.payroll.paid), money(p.ops.payroll.paid), <Trend cur={s.ops.payroll.paid} prev={p.ops.payroll.paid} goodWhenUp={false} />],
                        ] : []),
                        ["Laundry utilisation", `${s.laundry.utilization}%`, `${p.laundry.utilization}%`, <Trend cur={s.laundry.utilization} prev={p.laundry.utilization} unit=" pts" />],
                      ].map(([k, a, b, t]) => <tr key={k}><td className="py-2 pr-4">{k}</td><td className="py-2 pr-4 font-medium">{a}</td><td className="py-2 pr-4 text-muted">{b}</td><td className="py-2">{t}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>

        <aside className="print:hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Saved reports</h3>
          <PageState loading={history.loading} error={history.error} onRetry={history.reload}>
            {history.data?.length === 0 && <p className="text-sm text-muted">None yet.</p>}
            <ul className="space-y-1.5">
              {(history.data || []).map((r) => (
                <li key={r._id}>
                  <button onClick={() => openReport(r._id)} className={`w-full text-left rounded-md border px-3 py-2 text-sm transition ${report?._id === r._id ? "border-gold bg-gold/10" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <span className="block font-medium">{monthLabel(r.month)}</span>
                    <span className="block text-xs text-muted truncate">{r.hostelName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </PageState>
        </aside>
      </div>
    </div>
  );
};
export default Reports;
