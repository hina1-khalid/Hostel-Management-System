export const MAX_PHOTOS = 3;
export const MAX_BYTES = 2 * 1024 * 1024;

// Shrink a phone photo (often 4-8 MB) to max 1280px JPEG before uploading.
export async function compressImage(file, maxDim = 1280, quality = 0.8) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image`);
  if (typeof createImageBitmap !== "function") return checkSize(file); // very old browsers: upload as is
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // transparent PNGs would turn black in a JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) return checkSize(file);
  return checkSize(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
}

const checkSize = (file) => {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is too large (max 2 MB)`);
  return file;
};
