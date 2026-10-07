import React, { useState } from "react";
import { downloadFile } from "../utils/download";
import { Button } from "./ui";

// Download an Excel export from /api/export/:type  (params become the query string, e.g. {month:"2026-09"})
const ExportButton = ({ type, params = {}, label = "Export Excel" }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    try {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      await downloadFile(`/export/${type}${q ? `?${q}` : ""}`, `${type}.xlsx`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-end print:hidden">
      <Button variant="outline" onClick={go} disabled={busy} aria-label={`${label} (${type})`}>{busy ? "Preparing…" : `⬇ ${label}`}</Button>
      {error && <span role="alert" className="text-xs text-danger mt-1 max-w-[16rem] text-right">{error}</span>}
    </span>
  );
};
export default ExportButton;
