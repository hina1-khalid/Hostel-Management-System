import React, { useState } from "react";
import { downloadFile } from "../utils/download";
import { Button } from "./ui";

// Download the PDF receipt of a paid fee
const ReceiptButton = ({ fee }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    try { await downloadFile(`/fees/${fee._id}/receipt`, `receipt-${fee.receiptNumber || fee._id}.pdf`); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <span className="inline-flex flex-col items-end">
      <Button size="sm" variant="outline" onClick={go} disabled={busy} aria-label={`Download receipt ${fee.receiptNumber || ""}`}>{busy ? "…" : "⬇ Receipt"}</Button>
      {error && <span role="alert" className="text-xs text-danger mt-1">{error}</span>}
    </span>
  );
};
export default ReceiptButton;
