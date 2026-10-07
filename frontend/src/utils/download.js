import api, { errMsg } from "../api/axios";

// Download a file from an authenticated API endpoint (PDF / Excel). Throws an Error with a readable message.
export async function downloadFile(path, fallbackName = "download") {
  try {
    const res = await api.get(path, { responseType: "blob" });
    const disposition = res.headers["content-disposition"] || "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = match?.[1] || fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    let message = errMsg(e);
    // with responseType "blob" the JSON error body arrives as a Blob
    if (e.response?.data instanceof Blob) {
      try { message = JSON.parse(await e.response.data.text()).message || message; } catch { /* keep default */ }
    }
    throw new Error(message);
  }
}
