// Email sending via SMTP (Gmail, Outlook, Mailtrap, any provider). If SMTP_HOST is not set,
// emails are silently skipped so the rest of the app keeps working.
const nodemailer = require("nodemailer");

let transporter; // undefined = not initialised yet, null = disabled

const init = () => {
  if (transporter !== undefined) return transporter;
  if (!process.env.SMTP_HOST) {
    transporter = null;
    return transporter;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE) === "true" || port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    pool: true,
    maxConnections: 3,
  });
  return transporter;
};

const isConfigured = () => !!init();
const resetForTests = () => { if (transporter) transporter.close(); transporter = undefined; };

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clientUrl = () => (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");

// Simple, email-client-safe HTML (tables + inline styles)
const renderEmail = ({ name, title, message, link }) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#F7F5F0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
  <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;max-width:96%;">
    <tr><td style="background:#16213E;padding:18px 24px;color:#ffffff;font-size:16px;letter-spacing:.5px;">
      <span style="color:#C9A227;">&#9632;</span>&nbsp; Hostel Management System</td></tr>
    <tr><td style="padding:28px 24px;color:#16213E;">
      <p style="margin:0 0 6px;font-size:13px;color:#64748B;">Hello ${esc(name || "there")},</p>
      <h2 style="margin:0 0 12px;font-size:20px;">${esc(title)}</h2>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#334155;">${esc(message)}</p>
      ${link ? `<a href="${esc(clientUrl() + link)}" style="display:inline-block;background:#C9A227;color:#16213E;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px;font-size:14px;">Open in portal</a>` : ""}
    </td></tr>
    <tr><td style="padding:14px 24px;background:#F7F5F0;color:#94a3b8;font-size:11px;">
      You receive this because email notifications are on for your account. You can turn them off from My Profile.</td></tr>
  </table>
</td></tr></table></body></html>`;

const sendMail = async ({ to, subject, text, html }) => {
  const t = init();
  if (!t) return { skipped: true };
  return t.sendMail({
    from: process.env.MAIL_FROM || `"Hostel Management" <${process.env.SMTP_USER || "no-reply@hostel.local"}>`,
    to, subject, text, html,
  });
};

module.exports = { sendMail, renderEmail, isConfigured, resetForTests };
