import React, { useEffect, useState } from "react";
import useFetch from "./useFetch";
import { useAuth } from "../context/AuthContext";

// Superadmin picks a hostel; a warden is locked to their own hostel (picker is hidden).
export default function useHostelPicker({ allowAll = false } = {}) {
  const { user } = useAuth();
  const { data: hostels } = useFetch("/hostels");
  const locked = user.role === "admin" && user.hostel;
  const [hostelId, setHostelId] = useState("");

  useEffect(() => {
    if (locked) setHostelId(user.hostel);
    else if (hostels?.length && !hostelId && !allowAll) setHostelId(hostels[0]._id);
  }, [hostels, locked]); // eslint-disable-line

  const Picker = locked ? null : (
    <select aria-label="Hostel" className="input !w-auto" value={hostelId} onChange={(e) => setHostelId(e.target.value)}>
      {allowAll && <option value="">All hostels</option>}
      {(hostels || []).map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
    </select>
  );
  return { hostelId, setHostelId, hostels: hostels || [], Picker, locked: !!locked };
}
