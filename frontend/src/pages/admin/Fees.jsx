import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState, Select } from "../../components/ui";
import ExportButton from "../../components/ExportButton";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import useDebounce from "../../hooks/useDebounce";
import ReceiptButton from "../../components/ReceiptButton";
import { fmtDate, money, monthISO, nameOf } from "../../utils/format";

const TYPES = ["hostel_fee", "admission_fee", "electricity", "mess", "laundry", "internet", "security_deposit", "fine"];
const METHODS = ["cash", "bank_transfer", "easypaisa", "jazzcash", "card"];

const Fees = () => {
  const { hostelId, Picker } = useHostelPicker({ allowAll: true });
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  useEffect(() => setPage(1), [hostelId, status, dq]);
  const params = new URLSearchParams({ limit: PAGE_SIZE, page });
  if (hostelId) params.set("hostel", hostelId);
  if (status) params.set("status", status);
  if (dq.trim()) params.set("q", dq.trim());
  const { data, total, loading, error, reload } = useFetch(`/fees?${params}`);
  const students = useFetch("/students?limit=500");
  const [pay, setPay] = useState(null);
  const [method, setMethod] = useState("cash");
  const [txn, setTxn] = useState("");
  const [add, setAdd] = useState(null);
  const [gen, setGen] = useState(null);
  const [info, setInfo] = useState("");
  const { run, busy, error: formError, setError } = useAction();

  const markPaid = (e) => {
    e.preventDefault();
    run(async () => { await api.post(`/fees/${pay._id}/pay`, { paymentMethod: method, transactionId: txn || undefined }); setPay(null); setTxn(""); reload(); });
  };
  const createFee = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post("/fees", { ...add, amount: Number(add.amount), lateFee: Number(add.lateFee) || 0 });
      setAdd(null); reload();
    });
  };
  const generate = (e) => {
    e.preventDefault();
    run(async () => {
      const { data: r } = await api.post("/fees/generate-monthly", { ...gen, hostel: hostelId || undefined });
      setInfo(r.message); setGen(null); reload();
    });
  };

  return (
    <div>
      <PageHeader title="Fees" subtitle="Track dues, record payments and issue receipts.">
        {Picker}
        <input className="input !w-44" placeholder="Search student" aria-label="Search fees" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={setStatus} placeholder="All statuses" options={["pending", "paid", "overdue"]} />
        <ExportButton type="fees" params={{ hostel: hostelId, status }} />
        <Button variant="outline" onClick={() => { setError(""); setInfo(""); setGen({ month: monthISO(), dueDate: "" }); }}>Generate monthly</Button>
        <Button variant="gold" onClick={() => { setError(""); setAdd({ student: "", feeType: "hostel_fee", amount: "", lateFee: 0, dueDate: "", month: monthISO() }); }}>+ Add Fee</Button>
      </PageHeader>
      <div className="space-y-3 mb-3"><Alert type="success">{info}</Alert><Alert>{!pay && !add && !gen && formError}</Alert></div>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No fee records." columns={[
          { key: "student", label: "Student", render: (f) => (<div><p className="font-medium">{nameOf(f.student)}</p><p className="text-xs text-muted">{f.student?.registrationNumber}</p></div>) },
          { key: "feeType", label: "Type", render: (f) => <span className="capitalize">{f.feeType.replace("_", " ")}</span> },
          { key: "month", label: "Month" },
          { key: "totalAmount", label: "Amount", render: (f) => money(f.totalAmount) },
          { key: "dueDate", label: "Due", render: (f) => fmtDate(f.dueDate) },
          { key: "status", label: "Status", render: (f) => <Badge status={f.status} /> },
          { key: "receiptNumber", label: "Receipt", render: (f) => f.receiptNumber || "—" },
          { key: "act", label: "", render: (f) => (f.status !== "paid" ? <Button size="sm" variant="gold" onClick={() => { setError(""); setMethod("cash"); setPay(f); }}>Mark paid</Button> : <ReceiptButton fee={f} />) },
        ]} />
        <Pagination page={page} total={total} onChange={setPage} />
      </PageState>

      <Modal open={!!pay} title="Record payment" onClose={() => setPay(null)}>
        {pay && (
          <form onSubmit={markPaid} className="space-y-4">
            <p className="text-sm">{nameOf(pay.student)} — <strong>{money(pay.totalAmount)}</strong> ({pay.feeType.replace("_", " ")})</p>
            <Field label="Payment method"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</select></Field>
            {method !== "cash" && <Field label="Transaction ID"><input className="input" value={txn} onChange={(e) => setTxn(e.target.value)} /></Field>}
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPay(null)}>Cancel</Button><Button type="submit" disabled={busy}>Confirm payment</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!add} title="Add fee" onClose={() => setAdd(null)}>
        {add && (
          <form onSubmit={createFee} className="space-y-4">
            <Field label="Student">
              <select className="input" required value={add.student} onChange={(e) => setAdd({ ...add, student: e.target.value })}>
                <option value="">Select student</option>
                {(students.data || []).filter((s) => s.hostel).map((s) => <option key={s._id} value={s._id}>{s.user?.name} — {s.registrationNumber}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fee type"><select className="input" value={add.feeType} onChange={(e) => setAdd({ ...add, feeType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select></Field>
              <Field label="Month"><input className="input" value={add.month} onChange={(e) => setAdd({ ...add, month: e.target.value })} /></Field>
              <Field label="Amount (Rs)"><input className="input" type="number" min="0" required value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} /></Field>
              <Field label="Late fee (Rs)"><input className="input" type="number" min="0" value={add.lateFee} onChange={(e) => setAdd({ ...add, lateFee: e.target.value })} /></Field>
            </div>
            <Field label="Due date"><input className="input" type="date" required value={add.dueDate} onChange={(e) => setAdd({ ...add, dueDate: e.target.value })} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAdd(null)}>Cancel</Button><Button type="submit" disabled={busy}>Create fee</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!gen} title="Generate monthly hostel fees" onClose={() => setGen(null)}>
        {gen && (
          <form onSubmit={generate} className="space-y-4">
            <p className="text-sm text-muted">Creates one hostel-fee record (room rent) for every allocated student who doesn't already have one for the month.{!hostelId && " Applies to all hostels."}</p>
            <Field label="Month"><input className="input" required pattern="\d{4}-\d{2}" placeholder="YYYY-MM" value={gen.month} onChange={(e) => setGen({ ...gen, month: e.target.value })} /></Field>
            <Field label="Due date"><input className="input" type="date" required value={gen.dueDate} onChange={(e) => setGen({ ...gen, dueDate: e.target.value })} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setGen(null)}>Cancel</Button><Button type="submit" disabled={busy}>Generate</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Fees;
