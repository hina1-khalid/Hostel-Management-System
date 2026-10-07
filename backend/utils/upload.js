const multer = require("multer");

const MAX_PHOTOS = 3;
const MAX_BYTES = 2 * 1024 * 1024;

// multer only parses multipart requests, so normal JSON requests pass straight through
const photos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_PHOTOS },
}).array("photos", MAX_PHOTOS);

// Never trust the browser's file type: look at the first bytes of the file.
const sniffImage = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
};

module.exports = { photos, sniffImage, MAX_PHOTOS, MAX_BYTES };
