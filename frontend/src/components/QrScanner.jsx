import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

const friendly = (e) => {
  const name = e?.name || "";
  const msg = typeof e === "string" ? e : e?.message || "";
  if (name === "InsecureContext") return "The camera only works on https:// or http://localhost. Open the app from localhost.";
  if (name === "NotAllowedError" || /permission|denied/i.test(msg)) return "Camera permission was denied. Click the camera icon in the browser address bar, allow access, and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError" || /no camera|requested device not found/i.test(msg)) return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return msg || "Could not start the camera.";
};

// Live camera QR scanner. Calls onScan(text) for each code; the same code is ignored for 4 seconds.
const QrScanner = ({ onScan }) => {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const last = useRef({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    (async () => {
      setError("");
      setStarting(true);
      try {
        if (!window.isSecureContext) throw Object.assign(new Error("insecure"), { name: "InsecureContext" });
        const { Html5Qrcode } = await import("html5-qrcode"); // loaded only when the camera is opened
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            const now = Date.now();
            if (text === last.current.text && now - last.current.at < 4000) return;
            last.current = { text, at: now };
            navigator.vibrate?.(80);
            onScanRef.current(text);
          },
          () => {} // per-frame "no QR found" noise
        );
        if (cancelled) { await scanner.stop().catch(() => {}); scanner.clear(); }
      } catch (e) {
        if (!cancelled) { setError(friendly(e)); setActive(false); }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) Promise.resolve().then(() => s.stop()).then(() => s.clear()).catch(() => {});
    };
  }, [active]);

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button variant={active ? "outline" : "primary"} onClick={() => setActive((a) => !a)}>{active ? "Stop camera" : "📷 Scan with camera"}</Button>
        {starting && <span className="text-sm text-muted" role="status">Starting camera…</span>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-md bg-danger/10 border border-danger/20 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
      {active && (
        <div className="mt-3">
          <div id="qr-reader" data-testid="qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-slate-200 bg-black/5" />
          <p className="text-xs text-muted text-center mt-2">Hold the student's QR code in front of the camera. Each code is recorded automatically.</p>
        </div>
      )}
    </div>
  );
};
export default QrScanner;
