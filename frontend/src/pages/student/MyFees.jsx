import React from "react";
import useFetch from "../../hooks/useFetch";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import ReceiptButton from "../../components/ReceiptButton";
import { PageHeader, PageState } from "../../components/ui";
import { fmtDate, money } from "../../utils/format";

const MyFees = () => {
  const { data, loading, error, reload } = useFetch("/fees/me");
  const paid = (data || []).filter((f) => f.status === "paid").reduce((a, f) => a + f.totalAmount, 0);
  const due = (data || []).filter((f) => f.status !== "paid").reduce((a, f) => a + f.totalAmount, 0);
  return (
    <div>
      <PageHeader title="My Fees" subtitle="Payments are made at the hostel office; receipts appear here once recorded." />
      <PageState loading={loading} error={error} onRetry={reload}>
        <div className="grid grid-cols-2 gap-4 mb-6 max-w-lg"><StatCard label="Total paid" value={money(paid)} /><StatCard label="Outstanding" value={money(due)} accent /></div>
        <DataTable rows={data} emptyText="No fee records yet." columns={[
          { key: "feeType", label: "Type", render: (f) => <span className="capitalize">{f.feeType.replace("_", " ")}</span> },
          { key: "month", label: "Month" },
          { key: "totalAmount", label: "Amount", render: (f) => money(f.totalAmount) },
          { key: "dueDate", label: "Due", render: (f) => fmtDate(f.dueDate) },
          { key: "status", label: "Status", render: (f) => <Badge status={f.status} /> },
          { key: "paidDate", label: "Paid on", render: (f) => fmtDate(f.paidDate) },
          { key: "receiptNumber", label: "Receipt", render: (f) => (f.status === "paid" ? <div className="flex items-center gap-2"><span className="font-mono text-xs">{f.receiptNumber}</span><ReceiptButton fee={f} /></div> : "—") },
        ]} />
      </PageState>
    </div>
  );
};
export default MyFees;
