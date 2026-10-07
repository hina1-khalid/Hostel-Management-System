const PDFDocument = require("pdfkit");

const NAVY = "#16213E", GOLD = "#C9A227", MUTED = "#64748B";
const rs = (n) => `Rs ${Number(n || 0).toLocaleString("en-US")}`;
const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-");

// Fee receipt (A5). `fee` must have student(user), hostel populated; `room` is the student's room doc (optional).
const receiptPdf = (fee, room) => {
  const doc = new PDFDocument({ size: "A5", margin: 36, info: { Title: `Receipt ${fee.receiptNumber}`, Author: "Hostel Management System" } });
  const W = doc.page.width, L = 36, R = W - 36;

  // Header band
  doc.rect(0, 0, W, 78).fill(NAVY);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(15).text("HOSTEL MANAGEMENT SYSTEM", L, 24);
  doc.fillColor(GOLD).font("Helvetica").fontSize(10).text("OFFICIAL FEE RECEIPT", L, 46, { characterSpacing: 1.5 });

  // Receipt meta
  let y = 98;
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("RECEIPT NO.", L, y).text("DATE PAID", R - 120, y, { width: 120, align: "right" });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(fee.receiptNumber, L, y + 11).text(date(fee.paidDate), R - 120, y + 11, { width: 120, align: "right" });

  // Student block
  y = 142;
  doc.moveTo(L, y - 8).lineTo(R, y - 8).strokeColor("#E2E8F0").lineWidth(1).stroke();
  const label = (t, x, yy) => doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(t, x, yy);
  const value = (t, x, yy, w = 160) => doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text(String(t || "-"), x, yy, { width: w });
  const col2 = L + (R - L) / 2 + 6;
  label("STUDENT", L, y); value(fee.student?.user?.name, L, y + 11);
  label("REGISTRATION NO.", col2, y); value(fee.student?.registrationNumber, col2, y + 11);
  y += 40;
  label("HOSTEL", L, y); value(fee.hostel?.name, L, y + 11);
  label("ROOM", col2, y); value(room?.roomNumber ? `Room ${room.roomNumber}` : "-", col2, y + 11);

  // Charges table
  y += 48;
  doc.rect(L, y, R - L, 22).fill("#F1F5F9");
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("DESCRIPTION", L + 8, y + 7).text("AMOUNT", R - 108, y + 7, { width: 100, align: "right" });
  y += 30;
  const type = (fee.feeType || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const row = (name, amt) => {
    doc.fillColor(NAVY).font("Helvetica").fontSize(10).text(name, L + 8, y).text(amt, R - 108, y, { width: 100, align: "right" });
    y += 20;
  };
  row(`${type}${fee.month && fee.month !== "previous" ? ` (${fee.month})` : ""}`, rs(fee.amount));
  if (fee.lateFee) row("Late fee", rs(fee.lateFee));
  doc.moveTo(L, y).lineTo(R, y).strokeColor("#E2E8F0").stroke();
  y += 10;

  // Total box
  doc.rect(L, y, R - L, 34).fill(GOLD);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("TOTAL PAID", L + 10, y + 11).fontSize(14).text(rs(fee.totalAmount), R - 160, y + 9, { width: 150, align: "right" });
  y += 54;

  // Payment details
  label("PAYMENT METHOD", L, y); value(String(fee.paymentMethod || "-").replace(/_/g, " ").toUpperCase(), L, y + 11);
  label("TRANSACTION ID", col2, y); value(fee.transactionId || "-", col2, y + 11);
  y += 40;
  label("DUE DATE", L, y); value(date(fee.dueDate), L, y + 11);
  label("STATUS", col2, y); doc.fillColor("#2F855A").font("Helvetica-Bold").fontSize(10).text("PAID", col2, y + 11);

  // Footer
  doc.moveTo(L, doc.page.height - 70).lineTo(R, doc.page.height - 70).strokeColor("#E2E8F0").stroke();
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8)
    .text("This is a computer-generated receipt and does not require a signature.", L, doc.page.height - 58, { width: R - L, align: "center" });
  return doc;
};

// Monthly payslip (A5) for a hostel worker
const payslipPdf = (pay, staff, hostel) => {
  const doc = new PDFDocument({ size: "A5", margin: 36, info: { Title: `Payslip ${pay.month} ${staff.name}`, Author: "Hostel Management System" } });
  const W = doc.page.width, L = 36, R = W - 36;
  doc.rect(0, 0, W, 78).fill(NAVY);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(15).text("HOSTEL MANAGEMENT SYSTEM", L, 24);
  doc.fillColor(GOLD).font("Helvetica").fontSize(10).text("SALARY SLIP", L, 46, { characterSpacing: 1.5 });

  const label = (t, x, y) => doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(t, x, y);
  const value = (t, x, y, w = 170) => doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text(String(t || "-"), x, y, { width: w });
  const col2 = L + (R - L) / 2 + 6;
  let y = 98;
  label("EMPLOYEE", L, y); value(staff.name, L, y + 11);
  label("MONTH", col2, y); value(pay.month, col2, y + 11);
  y += 38;
  label("ROLE", L, y); value(String(staff.role || "").replace(/^./, (c) => c.toUpperCase()), L, y + 11);
  label("HOSTEL", col2, y); value(hostel?.name, col2, y + 11);

  y += 44;
  doc.rect(L, y, R - L, 22).fill("#F1F5F9");
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("DESCRIPTION", L + 8, y + 7).text("AMOUNT", R - 108, y + 7, { width: 100, align: "right" });
  y += 30;
  const row = (name, amt, color = NAVY) => {
    doc.fillColor(color).font("Helvetica").fontSize(10).text(name, L + 8, y, { width: 250 }).text(amt, R - 108, y, { width: 100, align: "right" });
    y += 19;
  };
  row("Monthly salary" + (pay.baseSalary !== staff.monthlySalary ? " (from joining day)" : ""), rs(pay.baseSalary));
  const dayBits = [pay.absentDays && `${pay.absentDays} absent`, pay.halfDays && `${pay.halfDays} half day`, pay.unpaidLeaveDays && `${pay.unpaidLeaveDays} unpaid leave`].filter(Boolean).join(", ");
  row(`Deductions${dayBits ? ` (${dayBits})` : ""}`, `- ${rs(pay.deduction)}`, "#C0392B");
  if (pay.bonus) row("Bonus", `+ ${rs(pay.bonus)}`, "#2F855A");
  if (pay.advance) row("Advance recovered", `- ${rs(pay.advance)}`, "#C0392B");
  doc.moveTo(L, y).lineTo(R, y).strokeColor("#E2E8F0").stroke();
  y += 10;
  doc.rect(L, y, R - L, 34).fill(GOLD);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("NET PAYABLE", L + 10, y + 11).fontSize(14).text(rs(pay.netSalary), R - 160, y + 9, { width: 150, align: "right" });
  y += 54;
  label("ATTENDANCE", L, y);
  doc.fillColor(NAVY).font("Helvetica").fontSize(9).text(`${pay.presentDays} present of ${pay.daysInMonth} days · ${pay.leaveDays} leave · ${pay.absentDays} absent · ${pay.halfDays} half day`, L, y + 11, { width: R - L });
  y += 36;
  label("STATUS", L, y); doc.fillColor(pay.status === "paid" ? "#2F855A" : "#B7791F").font("Helvetica-Bold").fontSize(10).text(pay.status === "paid" ? `PAID on ${date(pay.paidDate)} (${String(pay.paymentMethod || "cash").replace(/_/g, " ")})` : "PENDING", L, y + 11);
  if (pay.note) { label("NOTE", col2, y); doc.fillColor(NAVY).font("Helvetica").fontSize(9).text(pay.note, col2, y + 11, { width: R - col2 }); }

  doc.moveTo(L, doc.page.height - 70).lineTo(R, doc.page.height - 70).strokeColor("#E2E8F0").stroke();
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text("This is a computer-generated salary slip and does not require a signature.", L, doc.page.height - 58, { width: R - L, align: "center" });
  return doc;
};

module.exports = { receiptPdf, payslipPdf };
