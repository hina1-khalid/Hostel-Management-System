import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { Modal } from "./ui";

// An image stored on the server. It needs the login token, so it is fetched as a blob (a plain <img src> cannot send it).
export const AuthImage = ({ id, alt, className = "", onClick }) => {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url, cancelled = false;
    api.get(`/files/${id}`, { responseType: "blob" })
      .then((r) => { if (!cancelled) { url = URL.createObjectURL(r.data); setSrc(url); } })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  if (failed) return <span className="text-xs text-danger">Photo unavailable</span>;
  if (!src) return <span className={`inline-block bg-slate-100 animate-pulse rounded ${className}`} role="status" aria-label="Loading photo" />;
  const img = <img src={src} alt={alt} className={className} />;
  return onClick ? <button type="button" onClick={onClick} className="rounded overflow-hidden border border-slate-200 hover:opacity-90">{img}</button> : img;
};

// Row of thumbnails; click one to see it full size
const PhotoGallery = ({ ids = [] }) => {
  const [open, setOpen] = useState(null);
  if (!ids.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ids.map((id, i) => <AuthImage key={id} id={id} alt={`Complaint photo ${i + 1}`} className="h-20 w-20 object-cover" onClick={() => setOpen(id)} />)}
      </div>
      <Modal open={!!open} title="Photo" onClose={() => setOpen(null)} wide>
        {open && <AuthImage id={open} alt="Complaint photo enlarged" className="max-h-[70vh] mx-auto rounded" />}
      </Modal>
    </>
  );
};
export default PhotoGallery;
