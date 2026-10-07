import { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../api/axios";

// GET a URL and keep {data, loading, error}. Pass url=null to skip. reload() refetches.
export default function useFetch(url) {
  const [data, setData] = useState(null);
  const [total, setTotal] = useState(0); // from the X-Total-Count header of paginated lists
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!url) { setLoading(false); setData(null); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.get(url);
      setData(res.data);
      setTotal(Number(res.headers["x-total-count"]) || 0);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);
  return { data, total, loading, error, reload: load, setData };
}

// Wrap a form submit / button action: tracks busy + error
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(errMsg(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error, setError };
}
