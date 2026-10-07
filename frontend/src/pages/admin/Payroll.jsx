import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import { downloadFile } from "../../utils/download";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import ExportButton from "../../components/ExportButton";
import { Alert, Button, Field, Modal, PageHeader, PageState, Tabs } from "../../components/ui";
import { fmtDate, money, todayISO } from "../../utils/format";

const ROLES = ["cook", "cleaner", "guard", "gardener", "driver", "helper", "other"];
const cap = (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const prevMonth = () => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };

// ---------------- Staff list ----------------
const StaffTab = ({ hostelId, hostels, locked }) => {
  const [all, setAll] = useState(false);
  const { data, loading, error, reload } = useFetch(`/workforce/staff?${hostelId ? `hostel=${hostelId}&` : ""}${all ? "all=true" : ""}`);
  const [form, setForm] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const editing = form && form._id;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { name: form.name, role: form.role, phone: form.phone || undefined, cnic: form.cnic || undefined, joiningDate: form.joiningDate, monthlySalary: Number(form.monthlySalary), messStaff: !!form.messStaff, notes: form.notes || undefined };
      editing ? await api.put(`/workforce/staff/${form._id}`, { ...body, isActive: form.isActive }) : await api.post("/workforce/staff", { ...body, hostel: form.hostel || undefined });
      setForm(null); reload();
    });
  };
  const toggle = (s) => run(async () => { await api.put(`/workforce/staff/${s._id}`, { isActive: !s.isActive }); reload(); });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show people who left</label>
        <div className="flex-1" />
        <Button variant="gold" onClick={() => { setError(""); setForm({ hostel: hostelId || hostels[0]?._id || "", name: "", role: "cook", phone: "", cnic: "", joiningDate: todayISO(), monthlySalary: "", messStaff: false, notes: "" }); }}>+ Add worker</Button>
      </div>
      <Alert>{!form && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No workers yet. Add your cook, cleaners and guards." columns={[
          { key: "name", label: "Name", render: (s) => (<div><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{s.phone || "—"}</p></div>) },
          { key: "role", label: "Role", render: (s) => cap(s.role) },
          { key: "hostel", label: "Hostel", render: (s) => s.hostel?.code },
          { key: "monthlySalary", label: "Monthly salary", render: (s) => <strong>{money(s.monthlySalary)}</strong> },
          { key: "joiningDate", label: "Joined", render: (s) => fmtDate(s.joiningDate) },
          { key: "messStaff", label: "Mess cost", render: (s) => (s.messStaff ? "Yes" : "—") },
          { key: "isActive", label: "Status", render: (s) => <Badge status={s.isActive ? "active" : "blocked"} /> },
          { key: "act", label: "", render: (s) => (
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setError(""); setForm({ ...s, hostel: s.hostel?._id, joiningDate: s.joiningDate.slice(0, 10) }); }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => toggle(s)}>{s.isActive ? "Deactivate" : "Reactivate"}</Button>
            </div>) },
        ]} />
      </PageState>
      <Modal open={!!form} title={editing ? "Edit worker" : "Add worker"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            {!editing && !locked && <Field label="Hostel"><select className="input" required value={form.hostel} onChange={set("hostel")}>{hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}</select></Field>}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name"><input className="input" required minLength={2} value={form.name} onChange={set("name")} /></Field>
              <Field label="Role"><select className="input" value={form.role} onChange={set("role")}>{ROLES.map((r) => <option key={r} value={r}>{cap(r)}</option>)}</select></Field>
              <Field label="Monthly salary (Rs)"><input className="input" type="number" min="1" required value={form.monthlySalary} onChange={set("monthlySalary")} /></Field>
              <Field label="Joining date"><input className="input" type="date" required value={form.joiningDate} onChange={set("joiningDate")} /></Field>
              <Field label="Phone"><input className="input" value={form.phone || ""} onChange={set("phone")} /></Field>
              <Field label="CNIC"><input className="input" value={form.cnic || ""} onChange={set("cnic")} /></Field>
            </div>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={!!form.messStaff} onChange={(e) => setForm({ ...form, messStaff: e.target.checked })} /><span><span className="font-medium">Count the salary as a mess cost</span><span className="block text-xs text-muted">Tick for cooks and kitchen helpers. When you pay their salary it is added to the mess expenses (and to the cost per meal).</span></span></label>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};

// ---------------- Daily attendance ----------------
const OPTIONS = [["present", "Present", "bg-success text-white"], ["half_day", "Half day", "bg-warning text-white"], ["leave", "Leave", "bg-ink text-white"], ["absent", "Absent", "bg-danger text-white"]];

const AttendanceTab = ({ hostelId }) => {
  const [date, setDate] = useState(todayISO());
  const { data, loading, error, reload } = useFetch(`/workforce/attendance?${hostelId ? `hostel=${hostelId}&` : ""}date=${date}`);
  const [marks, setMarks] = useState({});
  const [msg, setMsg] = useState("");
  const { run, busy, error: saveError } = useAction();
  useEffect(() => { setMarks({}); setMsg(""); }, [data]);

  const shown = (s) => marks[s._id] || s.status || "present";
  const changed = Object.entries(marks).filter(([id, st]) => (data?.staff.find((s) => s._id === id)?.status || null) !== st);
  const save = () => run(async () => {
    const { data: r } = await api.post("/workforce/attendance", { date, records: changed.map(([staff, status]) => ({ staff, status })) });
    setMsg(r.message); reload();
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <input type="date" className="input !w-auto" aria-label="Date" max={todayISO()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <div className="flex-1" />
        <Button onClick={save} disabled={busy || changed.length === 0}>{busy ? "Saving…" : `Save ${changed.length || ""} change${changed.length === 1 ? "" : "s"}`}</Button>
      </div>
      <p className="text-xs text-muted mb-4">Everyone counts as <strong>present</strong> unless you mark them here. Only mark exceptions (absent, half day, leave).</p>
      <div className="space-y-3 mb-3"><Alert type="success">{msg}</Alert><Alert>{saveError}</Alert></div>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data?.staff} emptyText="No workers on the list for this date." columns={[
          { key: "name", label: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
          { key: "role", label: "Role", render: (s) => cap(s.role) },
          { key: "mark", label: "Status", render: (s) => (
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label={`Attendance for ${s.name}`}>
              {OPTIONS.map(([val, label, on]) => (
                <button key={val} onClick={() => setMarks({ ...marks, [s._id]: val })} aria-pressed={shown(s) === val}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${shown(s) === val ? `${on} border-transparent` : "bg-white border-slate-300 text-muted hover:bg-slate-50"}`}>{label}</button>
              ))}
            </div>) },
        ]} />
      </PageState>
    </div>
  );
};

// ---------------- Monthly payroll ----------------
const PayrollTab = ({ hostelId }) => {
  const [month, setMonth] = useState(prevMonth());
  const { data, loading, error, reload } = useFetch(`/workforce/payroll?${hostelId ? `hostel=${hostelId}&` : ""}month=${month}`);
  const [info, setInfo] = useState("");
  const [adj, setAdj] = useState(null);
  const [pay, setPay] = useState(null);
  const { run, busy, error: formError, setError } = useAction();

  const generate = () => run(async () => { const { data: r } = await api.post("/workforce/payroll/generate", { month, hostel: hostelId || undefined }); setInfo(r.message); reload(); });
  const saveAdj = (e) => { e.preventDefault(); run(async () => { await api.put(`/workforce/payroll/${adj._id}`, { bonus: Number(adj.bonus) || 0, advance: Number(adj.advance) || 0, note: adj.note || "" }); setAdj(null); reload(); }); };
  const doPay = (e) => { e.preventDefault(); run(async () => { await api.post(`/workforce/payroll/${pay._id}/pay`, { paymentMethod: pay.method }); setPay(null); reload(); }); };
  const slip = (p) => run(async () => { await downloadFile(`/workforce/payroll/${p._id}/payslip`, `payslip-${p.staff?.name}-${p.month}.pdf`); });
  const pending = data ? data.totalNet - data.paid : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <input type="month" className="input !w-auto" aria-label="Salary month" value={month} max={todayISO().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <Button variant="gold" onClick={generate} disabled={busy}>Calculate / refresh salaries</Button>
        <div className="flex-1" />
        <ExportButton type="payroll" params={{ hostel: hostelId, month }} />
      </div>
      <p className="text-xs text-muted mb-4">Salary = monthly salary − deductions + bonus − advance. Absent = 1 day cut, half day = ½ day, leave = free for the first 2 days a month, then cut. Unmarked days are present. Anyone who joined mid-month is paid from their joining day.</p>
      <div className="space-y-3 mb-3"><Alert type="success">{info}</Alert><Alert>{!adj && !pay && formError}</Alert></div>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="grid grid-cols-3 gap-4 mb-4 max-w-2xl">
            <StatCard label="Total payable" value={money(data.totalNet)} />
            <StatCard label="Paid" value={money(data.paid)} />
            <StatCard label="Still to pay" value={money(pending)} accent={pending > 0} />
          </div>
        )}
        <DataTable rows={data?.rows} emptyText="No salaries calculated for this month yet. Press “Calculate / refresh salaries”." columns={[
          { key: "name", label: "Name", render: (p) => (<div><p className="font-medium">{p.staff?.name}</p><p className="text-xs text-muted">{cap(p.staff?.role || "")}</p></div>) },
          { key: "baseSalary", label: "Base", render: (p) => money(p.baseSalary) },
          { key: "att", label: "Absent / ½ / unpaid leave", render: (p) => `${p.absentDays} / ${p.halfDays} / ${p.unpaidLeaveDays}` },
          { key: "deduction", label: "Deduction", render: (p) => (p.deduction ? <span className="text-danger">− {money(p.deduction)}</span> : "—") },
          { key: "bonus", label: "Bonus", render: (p) => (p.bonus ? <span className="text-success">+ {money(p.bonus)}</span> : "—") },
          { key: "advance", label: "Advance", render: (p) => (p.advance ? <span className="text-danger">− {money(p.advance)}</span> : "—") },
          { key: "netSalary", label: "Net salary", render: (p) => <strong>{money(p.netSalary)}</strong> },
          { key: "status", label: "Status", render: (p) => <Badge status={p.status} /> },
          { key: "act", label: "", render: (p) => (
            <div className="flex gap-2 justify-end flex-wrap">
              {p.status === "pending" && <Button size="sm" variant="outline" onClick={() => { setError(""); setAdj({ ...p }); }}>Adjust</Button>}
              {p.status === "pending" && <Button size="sm" variant="gold" onClick={() => { setError(""); setPay({ ...p, method: "cash" }); }}>Pay</Button>}
              <Button size="sm" variant="outline" onClick={() => slip(p)} aria-label={`Download payslip ${p.staff?.name}`}>⬇ Payslip</Button>
            </div>) },
        ]} />
      </PageState>

      <Modal open={!!adj} title={`Adjust salary: ${adj?.staff?.name || ""}`} onClose={() => setAdj(null)}>
        {adj && (
          <form onSubmit={saveAdj} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bonus (Rs)"><input className="input" type="number" min="0" value={adj.bonus} onChange={(e) => setAdj({ ...adj, bonus: e.target.value })} /></Field>
              <Field label="Advance to recover (Rs)"><input className="input" type="number" min="0" value={adj.advance} onChange={(e) => setAdj({ ...adj, advance: e.target.value })} /></Field>
            </div>
            <Field label="Note (printed on the payslip)"><input className="input" value={adj.note || ""} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAdj(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!pay} title={`Pay salary: ${pay?.staff?.name || ""}`} onClose={() => setPay(null)}>
        {pay && (
          <form onSubmit={doPay} className="space-y-4">
            <p className="text-sm">Net salary for {pay.month}: <strong>{money(pay.netSalary)}</strong></p>
            {pay.staff?.messStaff && <p className="text-xs text-muted">This salary will also be recorded as a mess expense.</p>}
            <Field label="Payment method"><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{["cash", "bank_transfer", "easypaisa", "jazzcash"].map((m) => <option key={m} value={m}>{cap(m)}</option>)}</select></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPay(null)}>Cancel</Button><Button type="submit" disabled={busy}>Confirm payment</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};

const Payroll = () => {
  const { hostelId, Picker, hostels, locked } = useHostelPicker({ allowAll: true });
  const [tab, setTab] = useState("staff");
  return (
    <div>
      <PageHeader title="Payroll" subtitle="Hostel workers (cook, cleaners, guards): daily attendance, monthly salaries and payslips.">{Picker}</PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[["staff", "Workers"], ["attendance", "Daily attendance"], ["payroll", "Salaries"]]} />
      {tab === "staff" && <StaffTab hostelId={hostelId} hostels={hostels} locked={locked} />}
      {tab === "attendance" && <AttendanceTab hostelId={hostelId} />}
      {tab === "payroll" && <PayrollTab hostelId={hostelId} />}
    </div>
  );
};
export default Payroll;
