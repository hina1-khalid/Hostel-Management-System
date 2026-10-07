import React, { useCallback, useRef, useState } from "react";
import useFetch from "../../hooks/useFetch";
import api, { errMsg } from "../../api/axios";
import Badge from "../../components/Badge";
import DataTable from "../../components/DataTable";
import QrScanner from "../../components/QrScanner";
import { Alert, Button, Card, Field, PageHeader } from "../../components/ui";
import { fmtDate, fmtDateTime, nameOf } from "../../utils/format";

const SecurityScan = () => {
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const input = useRef(null);
  const typeRef = useRef("");
  typeRef.current = type;
  const recent = useFetch("/qr-entries?limit=8");
  const reloadRecent = recent.reload;

  // Shared by the typed form and the camera
  const submitScan = useCallback(async (value) => {
    setBusy(true); setError(""); setResult(null);
    try {
      const { data } = await api.post("/qr-entries/scan", { qr: value.trim(), type: typeRef.current || undefined });
      setResult(data); setCode(""); reloadRecent();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }, [reloadRecent]);

  const onSubmit = (e) => { e.preventDefault(); submitScan(code); };

  return (
    <div>
      <PageHeader title="Gate Scanner" subtitle="Scan the student's QR code with the camera, a USB scanner, or type the registration number." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Record entry / exit">
          <div className="mb-5"><QrScanner onScan={submitScan} /></div>
          <div className="relative my-4 text-center"><span className="bg-white px-3 text-xs text-muted relative z-10">or enter manually</span><div className="absolute inset-x-0 top-1/2 border-t border-slate-200" /></div>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="QR / registration number"><input ref={input} className="input !py-3 font-mono" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="HMS|CS-2023-001" /></Field>
            <Field label="Direction" hint="Leave on Auto to alternate between entry and exit.">
              <div className="flex gap-2" role="radiogroup" aria-label="Direction">
                {[["", "Auto"], ["entry", "Entry"], ["exit", "Exit"]].map(([v, l]) => (
                  <button type="button" key={v} role="radio" aria-checked={type === v} onClick={() => setType(v)} className={`btn flex-1 ${type === v ? "btn-primary" : "btn-outline"}`}>{l}</button>
                ))}
              </div>
            </Field>
            <Button type="submit" variant="gold" className="w-full !py-3" disabled={busy || !code.trim()}>{busy ? "Recording…" : "Record"}</Button>
          </form>
          <div className="mt-4 space-y-3" aria-live="polite">
            <Alert>{error}</Alert>
            {result && (
              <div role="status" className={`rounded-md border px-4 py-3 ${result.isLateEntry ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/20"}`}>
                <p className="font-medium">{nameOf(result.student)} <span className="text-muted font-normal">({result.student?.registrationNumber})</span></p>
                <p className="text-sm mt-1 flex items-center gap-2"><Badge status={result.type} /> recorded at {fmtDateTime(result.timestamp)} {result.isLateEntry && <Badge status="late" />}</p>
                {result.leavePass
                  ? <p className="text-xs text-success mt-1">✔ Valid leave pass: {fmtDate(result.leavePass.from)} → {fmtDate(result.leavePass.to)} ({result.leavePass.leaveType})</p>
                  : result.onApprovedLeave && <p className="text-xs text-success mt-1">✔ Student has an approved leave today.</p>}
              </div>
            )}
          </div>
        </Card>
        <Card title="Recent activity">
          <DataTable rows={recent.data} emptyText="Nothing recorded yet." columns={[
            { key: "student", label: "Student", render: (l) => nameOf(l.student) },
            { key: "type", label: "", render: (l) => <Badge status={l.type} /> },
            { key: "timestamp", label: "Time", render: (l) => fmtDateTime(l.timestamp) },
          ]} />
        </Card>
      </div>
    </div>
  );
};
export default SecurityScan;
