// Smoke test: logs in as each role and renders every page against the REAL backend
// (start the backend with demo data first: `npm run seed` then `npm run dev` in /backend).
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import App from "../App";
import api from "../api/axios";

// Fake camera library: lets us "scan" a QR code without hardware
const camera = vi.hoisted(() => ({ mode: "ok", code: "HMS|CS-2023-002", started: 0, stopped: 0 }));
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    async start(_cfg, _conf, onSuccess) {
      if (camera.mode === "denied") throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
      if (camera.mode === "none") throw "Requested device not found";
      camera.started++;
      setTimeout(() => onSuccess(camera.code), 20);
    }
    async stop() { camera.stopped++; }
    clear() {}
  },
}));

// jsdom has no ResizeObserver (real browsers do); recharts needs it
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const accounts = {
  superadmin: ["admin@hostel.com", "Admin@123"],
  warden: ["warden@hostel.com", "Warden@123"],
  student: ["ali@student.com", "Student@123"],
  security: ["guard@hostel.com", "Guard@123"],
};

const loginAs = async (who) => {
  const { data } = await api.post("/auth/login", { email: accounts[who][0], password: accounts[who][1] });
  localStorage.setItem("token", data.token);
  localStorage.setItem("userInfo", JSON.stringify(data));
};
const open = (path) =>
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

// [role, path, text that must appear once data has loaded]
const pages = [
  ["superadmin", "/admin", "Fees collected"],
  ["superadmin", "/admin/hostels", "Iqbal Hostel"],
  ["superadmin", "/admin/rooms", "Room"],
  ["superadmin", "/admin/students", "Ali Khan"],
  ["superadmin", "/admin/fees", "Mark paid"],
  ["superadmin", "/admin/attendance", "Save attendance"],
  ["superadmin", "/admin/leaves", "Leave Requests"],
  ["superadmin", "/admin/complaints", "Fan sparking in room"],
  ["superadmin", "/admin/visitors", "Visitors"],
  ["superadmin", "/admin/entry-logs", "Entry Logs"],
  ["superadmin", "/admin/notices", "Welcome to the new semester"],
  ["superadmin", "/admin/mess", "Weekly menu"],
  ["superadmin", "/admin/laundry", "Washer 1"],
  ["superadmin", "/admin/inventory", "Ceiling Fan"],
  ["superadmin", "/admin/staff", "Warden Iqbal"],
  ["superadmin", "/admin/reports", "Generate report"],
  ["superadmin", "/admin/audit", "event: signed in"],
  ["superadmin", "/admin/maintenance", "Active jobs"],
  ["warden", "/admin/maintenance", "Active jobs"],
  ["superadmin", "/admin/payroll", "Add worker"],
  ["warden", "/admin/payroll", "Add worker"],
  ["superadmin", "/admin/room-requests", "Waiting list"],
  ["warden", "/admin/room-requests", "Waiting list"],
  ["student", "/student/room-requests", "Request a room change"],
  ["superadmin", "/admin/profile", "Change password"],
  ["student", "/student/profile", "Change password"],
  ["security", "/security/profile", "Change password"],
  ["warden", "/admin", "Fees collected"],
  ["student", "/student", "Amount due"],
  ["student", "/student/room", "Gate pass"],
  ["student", "/student/fees", "Outstanding"],
  ["student", "/student/attendance", "My Attendance"],
  ["student", "/student/complaints", "Fan sparking in room"],
  ["student", "/student/leaves", "My Leave"],
  ["student", "/student/visitors", "My Visitors"],
  ["student", "/student/mess", "Weekly menu"],
  ["student", "/student/laundry", "Available slots"],
  ["student", "/student/notices", "Welcome to the new semester"],
  ["security", "/security", "Record entry / exit"],
  ["security", "/security/visitors", "Register visitor"],
  ["security", "/security/logs", "Entry Logs"],
  ["security", "/security/notices", "Welcome to the new semester"],
];

describe("every page renders with live data", () => {
  it.each(pages)("%s → %s", async (who, path, text) => {
    await loginAs(who);
    open(path);
    await waitFor(() => expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0), { timeout: 15000 });
    expect(screen.queryByText(/Cannot reach the server/i)).toBeNull();
    expect(screen.queryByText(/Try again/i)).toBeNull();
  });
});

describe("auth behaviour", () => {
  it("wrong password shows an error and stays on login (no reload)", async () => {
    open("/login");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "ali@student.com");
    await user.type(screen.getByLabelText(/password/i), "nope-nope");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeTruthy();
  });

  it("student is redirected away from admin pages", async () => {
    await loginAs("student");
    open("/admin/fees");
    await waitFor(() => expect(screen.getAllByText(/Amount due/i).length).toBeGreaterThan(0));
  });

  it("warden does not see the Hostels menu item", async () => {
    await loginAs("warden");
    open("/admin");
    await screen.findByText(/Fees collected/i);
    const nav = screen.getByRole("navigation", { name: /main/i });
    expect(within(nav).queryByText("Hostels")).toBeNull();
    expect(within(nav).getByText("Rooms")).toBeTruthy();
  });

  it("login redirects each role to its home", async () => {
    open("/login");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "guard@hostel.com");
    await user.type(screen.getByLabelText(/password/i), "Guard@123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/Record entry \/ exit/i)).toBeTruthy();
  });
});

describe("key workflows through the UI", () => {
  it("guard scans a student QR and sees the result", async () => {
    await loginAs("security");
    open("/security");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/QR \/ registration/i), "HMS|CS-2023-002");
    await user.click(screen.getByRole("button", { name: /^record$/i }));
    expect(await screen.findByText(/Hamza Sheikh/i)).toBeTruthy();
  });

  it("student files a complaint and it appears in the list", async () => {
    await loginAs("student");
    open("/student/complaints");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /new complaint/i }));
    await user.type(screen.getByPlaceholderText(/fan not working/i), "Window glass cracked");
    const dlg = screen.getByRole("dialog");
    await user.type(within(dlg).getByRole("textbox", { name: /describe the problem/i }), "The window glass in my room is cracked");
    await user.click(within(dlg).getByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Window glass cracked", {}, { timeout: 10000 })).toBeTruthy();
  });

  it("chatbot answers a question", async () => {
    await loginAs("student");
    open("/student");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /open hostel assistant/i }));
    await user.type(screen.getByLabelText("Message"), "What fees do I have due?");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(await screen.findByText(/unpaid fees|no unpaid/i, {}, { timeout: 10000 })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe("camera QR scanning", () => {
  beforeEach(() => {
    camera.mode = "ok"; camera.started = 0; camera.stopped = 0;
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  });

  it("guard opens the camera, a QR is decoded and the entry is recorded", async () => {
    await loginAs("security");
    open("/security");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /scan with camera/i }));
    expect(await screen.findByTestId("qr-reader")).toBeTruthy();
    expect(await screen.findByText(/Hamza Sheikh/i, {}, { timeout: 10000 })).toBeTruthy();
    expect(camera.started).toBe(1);
    await user.click(screen.getByRole("button", { name: /stop camera/i }));
    await waitFor(() => expect(camera.stopped).toBeGreaterThan(0));
    expect(screen.queryByTestId("qr-reader")).toBeNull();
  });

  it("shows a helpful message when camera permission is denied", async () => {
    camera.mode = "denied";
    await loginAs("security");
    open("/security");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /scan with camera/i }));
    expect(await screen.findByText(/camera permission was denied/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /scan with camera/i })).toBeTruthy(); // can retry
  });

  it("shows a message when there is no camera", async () => {
    camera.mode = "none";
    await loginAs("security");
    open("/security");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /scan with camera/i }));
    expect(await screen.findByText(/no camera was found/i)).toBeTruthy();
  });

  it("explains when the page is not secure (http on a real network)", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    await loginAs("security");
    open("/security");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /scan with camera/i }));
    expect(await screen.findByText(/only works on https/i)).toBeTruthy();
  });
});

describe("PDF receipts and Excel exports", () => {
  let created, clicked;
  beforeEach(() => {
    created = [];
    clicked = [];
    URL.createObjectURL = (blob) => { created.push(blob); return "blob:fake"; };
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { clicked.push(this.download); });
  });
  afterEach(() => vi.restoreAllMocks());

  it("admin downloads a real PDF receipt for a paid fee", async () => {
    await loginAs("superadmin");
    open("/admin/fees");
    const user = userEvent.setup();
    const btn = await screen.findAllByRole("button", { name: /download receipt RCP/i }, { timeout: 10000 });
    await user.click(btn[0]);
    await waitFor(() => expect(clicked.length).toBe(1));
    expect(clicked[0]).toMatch(/^receipt-RCP-.*\.pdf$/);
    expect(created[0].type).toMatch(/pdf/);
    expect(created[0].size).toBeGreaterThan(1500);
    expect(Buffer.from(await created[0].arrayBuffer()).slice(0, 5).toString()).toBe("%PDF-");
  });

  it("student sees a receipt button only on paid fees", async () => {
    // log in as hamza, who has the paid demo fee
    const { data } = await api.post("/auth/login", { email: "hamza@student.com", password: "Student@123" });
    localStorage.setItem("token", data.token);
    localStorage.setItem("userInfo", JSON.stringify(data));
    open("/student/fees");
    await screen.findByText(/Outstanding/i);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /download receipt/i }).length).toBe(1));
  });

  it("admin exports students to a real .xlsx file", async () => {
    await loginAs("superadmin");
    open("/admin/students");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /export excel \(students\)/i }));
    await waitFor(() => expect(clicked.length).toBe(1));
    expect(clicked[0]).toMatch(/^students-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(created[0].type).toMatch(/spreadsheetml/);
    expect(Buffer.from(await created[0].arrayBuffer()).slice(0, 2).toString()).toBe("PK"); // xlsx = zip
  });

  it("a failed download shows the server's message instead of a broken file", async () => {
    await loginAs("warden");
    open("/admin/attendance");
    const user = userEvent.setup();
    await screen.findByText(/Save attendance/i);
    // force a bad month to hit the 400 error path of the export endpoint
    const { downloadFile } = await import("../utils/download");
    await expect(downloadFile("/export/attendance?month=oops")).rejects.toThrow(/month must be YYYY-MM/);
    expect(clicked.length).toBe(0);
    void user;
  });
});

describe("monthly report and profile", () => {
  it("admin generates a monthly report and sees the narrative and numbers", async () => {
    await loginAs("warden");
    open("/admin/reports");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /generate report/i }));
    const report = await screen.findByTestId("report", {}, { timeout: 15000 });
    expect(within(report).getAllByText(/Iqbal Hostel/).length).toBeGreaterThan(0);
    expect(within(report).getByText(/Auto-generated summary/i)).toBeTruthy();
    expect(within(report).getByText(/Recommended actions/i)).toBeTruthy();
    expect(within(report).getByText(/Key numbers vs previous month/i)).toBeTruthy();
    expect(within(report).getByText(/Occupancy rate/i)).toBeTruthy();
    // the new report also shows up in "Saved reports"
    expect((await screen.findAllByText(/Iqbal Hostel/)).length).toBeGreaterThan(1);
  });

  it("student updates their profile and the name in the sidebar changes", async () => {
    await loginAs("student");
    open("/student/profile");
    const user = userEvent.setup();
    const name = await screen.findByLabelText(/full name/i);
    await user.clear(name);
    await user.type(name, "Ali K. Khan");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/profile saved/i)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("userInfo")).name).toBe("Ali K. Khan");
    expect((await screen.findAllByText("Ali K. Khan")).length).toBeGreaterThan(0);
  });

  it("test-email button explains when email is not configured", async () => {
    await loginAs("student");
    open("/student/profile");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /send me a test email/i }));
    expect(await screen.findByText(/email is not configured/i)).toBeTruthy();
  });

  it("password change validates mismatching passwords", async () => {
    await loginAs("student");
    open("/student/profile");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/current password/i), "Student@123");
    await user.type(screen.getByLabelText(/^new password/i), "Newpass123");
    await user.type(screen.getByLabelText(/confirm new password/i), "Different1");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/do not match/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pngFile = (name = "crack.png") => new File([Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0))], name, { type: "image/png" });
const apiAs = async (who) => {
  const { data } = await api.post("/auth/login", { email: accounts[who][0], password: accounts[who][1] });
  return (method, path, body) => fetch(`http://localhost:5000/api${path}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${data.token}` }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));
};
const ymd = (n = 0) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

describe("forgot / reset password pages", () => {
  it("login page links to Forgot password, which shows the generic confirmation", async () => {
    open("/login");
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: /forgot password/i }));
    await user.type(await screen.findByLabelText(/^email/i), "ali@student.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/if an account with that email exists/i)).toBeTruthy();
  });

  it("an invalid reset link shows a clear error and a way to request a new one", async () => {
    open(`/reset-password/${"a".repeat(64)}`);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^new password/i), "Brand-new-1");
    await user.type(screen.getByLabelText(/confirm password/i), "Brand-new-1");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/invalid or has expired/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /request a new link/i })).toBeTruthy();
  });

  it("mismatching passwords are caught before calling the server", async () => {
    open(`/reset-password/${"b".repeat(64)}`);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^new password/i), "Brand-new-1");
    await user.type(screen.getByLabelText(/confirm password/i), "Different-2");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/do not match/i)).toBeTruthy();
  });
});

describe("complaint photos", () => {
  beforeEach(() => { URL.createObjectURL = () => "blob:fake-photo"; URL.revokeObjectURL = () => {}; });

  it("student attaches a photo; it shows up for the student and for the warden", async () => {
    await loginAs("student");
    open("/student/complaints");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /new complaint/i }));
    await user.type(screen.getByPlaceholderText(/fan not working/i), "Window crack photo");
    const dlg = screen.getByRole("dialog");
    await user.type(within(dlg).getByRole("textbox", { name: /describe the problem/i }), "There is a big crack in my window glass");
    await user.upload(within(dlg).getByLabelText(/add photos/i), pngFile("crack.png"));
    expect(await within(dlg).findByText(/crack\.png/)).toBeTruthy();
    await user.click(within(dlg).getByRole("button", { name: /submit/i }));
    const title = await screen.findByText("Window crack photo", {}, { timeout: 10000 });
    const card = title.closest("section");
    expect(within(card).getByText(/1 photo/)).toBeTruthy();
    await user.click(within(card).getByRole("button", { name: /open/i }));
    expect(await screen.findByRole("img", { name: /complaint photo 1/i }, { timeout: 10000 })).toBeTruthy();
    cleanup();

    // the warden of that hostel can see it too
    localStorage.clear();
    await loginAs("warden");
    open("/admin/complaints");
    await user.type(await screen.findByLabelText(/search complaints/i), "Window crack");
    const row = (await screen.findByText("Window crack photo", {}, { timeout: 10000 })).closest("tr");
    await user.click(within(row).getByRole("button", { name: /open/i }));
    expect(await screen.findByRole("img", { name: /complaint photo 1/i }, { timeout: 10000 })).toBeTruthy();
  });

  it("a non-image file is refused before uploading", async () => {
    await loginAs("student");
    open("/student/complaints");
    const user = userEvent.setup({ applyAccept: false });
    await user.click(await screen.findByRole("button", { name: /new complaint/i }));
    const dlg = screen.getByRole("dialog");
    await user.upload(within(dlg).getByLabelText(/add photos/i), new File(["hello"], "notes.txt", { type: "text/plain" }));
    expect(await within(dlg).findByText(/not an image/i)).toBeTruthy();
  });
});

describe("leave gate pass", () => {
  it("student shows a QR pass for an approved leave and the guard accepts it", async () => {
    await loginAs("student");
    const student = await apiAs("student");
    const created = await student("POST", "/leaves", { reason: "Family wedding in Lahore", fromDate: ymd(0), toDate: ymd(2) });
    expect(created.status).toBe(201);
    const warden = await apiAs("warden");
    expect((await warden("PUT", `/leaves/${created.data._id}/decision`, { status: "approved", approvalRemarks: "ok" })).status).toBe(200);

    open("/student/leaves");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /gate pass/i }));
    expect(await screen.findByTestId("leave-qr")).toBeTruthy();
    expect(screen.getByText(/show this code to the guard/i)).toBeTruthy();
    cleanup(); localStorage.clear();

    await loginAs("security");
    open("/security");
    await user.type(await screen.findByLabelText(/QR \/ registration/i), `HMS|LEAVE|${created.data._id}`);
    await user.click(screen.getByRole("button", { name: /^record$/i }));
    expect(await screen.findByText(/valid leave pass/i, {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText(/CS-2023-001/)).toBeTruthy(); // registration number (the name may have been edited by an earlier test)
  });
});

describe("room requests", () => {
  it("student sends a change request and then cancels it", async () => {
    await loginAs("student");
    open("/student/room-requests");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^reason/i), "It is too noisy near the stairs");
    await user.click(screen.getByRole("button", { name: /send request/i }));
    expect(await screen.findByText(/request sent to the warden/i)).toBeTruthy();
    const mine = await screen.findByText(/too noisy near the stairs/i);
    expect(within(mine.closest("tr")).getByText("pending")).toBeTruthy();
    // cannot send a second one while one is open
    expect(screen.getByText(/already have an open request/i)).toBeTruthy();
    await user.click(within(mine.closest("tr")).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(within(screen.getByText(/too noisy near the stairs/i).closest("tr")).getByText("cancelled")).toBeTruthy());
  });

  it("warden allocates a student from the waiting list", async () => {
    const hostels = (await (await apiAs("superadmin"))("GET", "/hostels")).data;
    const iqbal = hostels.find((h) => h.code === "IQB");
    const bilal = await (async () => {
      const { data } = await api.post("/auth/login", { email: "bilal@student.com", password: "Student@123" });
      return (method, path, body) => fetch(`http://localhost:5000/api${path}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${data.token}` }, body: JSON.stringify(body) }).then((r) => r.status);
    })();
    expect(await bilal("POST", "/room-requests", { reason: "Newly admitted, need a room", hostel: iqbal._id })).toBe(201);

    await loginAs("warden");
    open("/admin/room-requests");
    const user = userEvent.setup();
    const row = (await screen.findByText("Bilal Ahmed", {}, { timeout: 10000 })).closest("tr");
    await user.click(within(row).getByRole("button", { name: /allocate/i }));
    const dlg = await screen.findByRole("dialog");
    const select = within(dlg).getByLabelText(/allocate room/i);
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(select, within(select).getByRole("option", { name: /Room 103/ }));
    await user.click(within(dlg).getByRole("button", { name: /^allocate$/i }));
    await waitFor(() => expect(screen.queryByText("Bilal Ahmed")).toBeNull(), { timeout: 10000 });
    expect(await screen.findByRole("tab", { name: /waiting list \(0\)/i }, { timeout: 10000 })).toBeTruthy(); // waits for the list to reload
  });
});

describe("audit log, pagination and navigation", () => {
  it("superadmin pages through the audit log and can search it", async () => {
    await loginAs("superadmin");
    open("/admin/audit");
    const user = userEvent.setup();
    const nav = await screen.findByTestId("pagination", {}, { timeout: 10000 });
    expect(within(nav).getByText(/Showing 1–15 of/)).toBeTruthy();
    await user.click(within(nav).getByRole("button", { name: /next/i }));
    expect(await screen.findByText(/Page 2 of/)).toBeTruthy();
    await user.type(screen.getByLabelText(/search audit log/i), "zzz-nobody-has-this-name");
    expect(await screen.findByText(/no activity matches these filters/i, {}, { timeout: 10000 })).toBeTruthy();
  });

  it("lists show 'Showing 1–N of N' counts from the server", async () => {
    await loginAs("superadmin");
    open("/admin/students");
    expect(await screen.findByText(/Showing 1–6 of 6/, {}, { timeout: 10000 })).toBeTruthy();
  });

  it("menu: Audit Log only for superadmin, Room Requests for students", async () => {
    await loginAs("warden");
    open("/admin");
    await screen.findByText(/Fees collected/i);
    let nav = screen.getByRole("navigation", { name: /main/i });
    expect(within(nav).queryByText("Audit Log")).toBeNull();
    expect(within(nav).getByText("Room Requests")).toBeTruthy();
    cleanup(); localStorage.clear();
    await loginAs("superadmin");
    open("/admin");
    await screen.findByText(/Fees collected/i);
    expect(within(screen.getByRole("navigation", { name: /main/i })).getByText("Audit Log")).toBeTruthy();
    cleanup(); localStorage.clear();
    await loginAs("student");
    open("/student");
    await screen.findByText(/Amount due/i);
    expect(within(screen.getByRole("navigation", { name: /main/i })).getByText("Room Requests")).toBeTruthy();
  });

  it("a warden who types the audit URL is sent away", async () => {
    await loginAs("warden");
    open("/admin/audit");
    await waitFor(() => expect(screen.queryByText(/Every change made in the system/i)).toBeNull());
  });
});

describe("installable app (PWA)", () => {
  it("has a valid manifest, icons and a service worker that never caches the API", async () => {
    const fs = await import("node:fs");
    const read = (p) => fs.readFileSync(`${process.cwd()}/public/${p}`);
    const manifest = JSON.parse(read("manifest.webmanifest"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    manifest.icons.forEach((i) => expect(read(i.src.slice(1)).slice(1, 4).toString()).toBe("PNG"));
    const sw = read("sw.js").toString();
    expect(sw).toMatch(/startsWith\("\/api"\)/);
    expect(fs.readFileSync(`${process.cwd()}/index.html`, "utf8")).toMatch(/rel="manifest"/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("maintenance schedule", () => {
  it("warden sees an overdue job, marks it done, and the next date is scheduled", async () => {
    const warden = await apiAs("warden");
    const made = await warden("POST", "/maintenance", { title: "Geyser descaling (UI test)", category: "geyser", intervalDays: 60, firstDueDate: ymd(-1) });
    expect(made.status).toBe(201);
    await loginAs("warden");
    open("/admin/maintenance");
    const user = userEvent.setup();
    let row = (await screen.findByText("Geyser descaling (UI test)", {}, { timeout: 10000 })).closest("tr");
    expect(within(row).getByText(/1 day\(s\) overdue/)).toBeTruthy();
    expect(within(row).getByText("overdue")).toBeTruthy();
    await user.click(within(row).getByRole("button", { name: /mark done/i }));
    const dlg = await screen.findByRole("dialog");
    await user.clear(within(dlg).getByLabelText(/actual cost/i));
    await user.type(within(dlg).getByLabelText(/actual cost/i), "3000");
    await user.type(within(dlg).getByLabelText(/^notes/i), "Descaled all geysers");
    await user.click(within(dlg).getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      row = screen.getByText("Geyser descaling (UI test)").closest("tr");
      expect(within(row).getByText(/In 60 day\(s\)/)).toBeTruthy();
    }, { timeout: 10000 });
    expect(within(row).getByRole("button", { name: /history \(1\)/i })).toBeTruthy();
    await user.click(within(row).getByRole("button", { name: /history/i }));
    expect(await screen.findByText(/Descaled all geysers/)).toBeTruthy();
  });

  it("dashboard shows the maintenance and low-stock cards; menu has Maintenance and Payroll", async () => {
    await loginAs("superadmin");
    open("/admin");
    expect(await screen.findByText("Maintenance overdue", {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText("Low stock items")).toBeTruthy();
    const nav = within(screen.getByRole("navigation", { name: /main/i }));
    expect(nav.getByText("Maintenance")).toBeTruthy();
    expect(nav.getByText("Payroll")).toBeTruthy();
  });
});

describe("mess expenses, stock and cost analysis", () => {
  it("warden records an expense, manages stock, and sees the cost analysis", async () => {
    await loginAs("warden");
    open("/admin/mess");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("tab", { name: /^expenses$/i }));
    const add = await screen.findByRole("button", { name: /add expense/i });
    await waitFor(() => expect(add.disabled).toBe(false));
    await user.click(add);
    let dlg = await screen.findByRole("dialog");
    await user.type(within(dlg).getByLabelText(/what was bought/i), "Flour 100 kg (UI test)");
    await user.type(within(dlg).getByLabelText(/^amount/i), "18000");
    await user.click(within(dlg).getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText("Flour 100 kg (UI test)", {}, { timeout: 10000 })).toBeTruthy();
    expect((await screen.findAllByText("Rs 18,000")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: /^stock$/i }));
    const addItem = await screen.findByRole("button", { name: /add item/i });
    await waitFor(() => expect(addItem.disabled).toBe(false));
    await user.click(addItem);
    dlg = await screen.findByRole("dialog");
    await user.type(within(dlg).getByLabelText(/^item/i), "Cooking oil (UI test)");
    await user.selectOptions(within(dlg).getByLabelText(/^unit/i), "litre");
    await user.clear(within(dlg).getByLabelText(/opening quantity/i));
    await user.type(within(dlg).getByLabelText(/opening quantity/i), "10");
    await user.clear(within(dlg).getByLabelText(/alert when at or below/i));
    await user.type(within(dlg).getByLabelText(/alert when at or below/i), "5");
    await user.click(within(dlg).getByRole("button", { name: /^save$/i }));
    let row = (await screen.findByText("Cooking oil (UI test)", {}, { timeout: 10000 })).closest("tr");
    expect(within(row).getByText("10 litre")).toBeTruthy();

    await user.click(within(row).getByRole("button", { name: /^use$/i }));
    dlg = await screen.findByRole("dialog");
    await user.type(within(dlg).getByLabelText(/^quantity/i), "6");
    await user.click(within(dlg).getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      row = screen.getByText("Cooking oil (UI test)").closest("tr");
      expect(within(row).getByText("4 litre")).toBeTruthy();
    }, { timeout: 10000 });
    expect(await screen.findByText(/at or below the alert level/i)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /cost analysis/i }));
    const analysis = await screen.findByTestId("mess-analysis", {}, { timeout: 10000 });
    expect(within(analysis).getByText("Total spent")).toBeTruthy();
    expect(within(analysis).getByText("Cost per meal")).toBeTruthy();
    expect(within(analysis).getByText("Spent vs billed, last 6 months")).toBeTruthy();
  });
});

describe("payroll", () => {
  let created, clicked;
  beforeEach(() => {
    created = []; clicked = [];
    URL.createObjectURL = (b) => { created.push(b); return "blob:fake"; };
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { clicked.push(this.download); });
  });
  afterEach(() => vi.restoreAllMocks());

  it("warden adds a worker, marks absence, calculates salary, pays it and downloads the payslip", async () => {
    await loginAs("warden");
    open("/admin/payroll");
    const user = userEvent.setup();

    // 1) add a worker through the form
    await user.click(await screen.findByRole("button", { name: /add worker/i }));
    let dlg = await screen.findByRole("dialog");
    await user.type(within(dlg).getByLabelText(/full name/i), "Ramzan Cook");
    await user.type(within(dlg).getByLabelText(/monthly salary/i), "30000");
    fireEvent.change(within(dlg).getByLabelText(/joining date/i), { target: { value: "2025-01-01" } });
    await user.click(within(dlg).getByLabelText(/count the salary as a mess cost/i));
    await user.click(within(dlg).getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText("Ramzan Cook", {}, { timeout: 10000 })).toBeTruthy();

    // 2) mark him absent today
    await user.click(screen.getByRole("tab", { name: /daily attendance/i }));
    const group = await screen.findByRole("group", { name: /attendance for ramzan cook/i }, { timeout: 10000 });
    await user.click(within(group).getByRole("button", { name: "Absent" }));
    await user.click(screen.getByRole("button", { name: /save 1 change/i }));
    expect(await screen.findByText(/attendance saved for 1 person/i)).toBeTruthy();

    // 3) salaries for this month
    await user.click(screen.getByRole("tab", { name: /^salaries$/i }));
    fireEvent.change(await screen.findByLabelText(/salary month/i), { target: { value: new Date().toISOString().slice(0, 7) } });
    await user.click(screen.getByRole("button", { name: /calculate \/ refresh salaries/i }));
    const row = (await screen.findByText("Ramzan Cook", {}, { timeout: 10000 })).closest("tr");
    expect(within(row).getByText("1 / 0 / 0")).toBeTruthy();
    expect(within(row).getByText("pending")).toBeTruthy();

    // 4) pay
    await user.click(within(row).getByRole("button", { name: /^pay$/i }));
    dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText(/also be recorded as a mess expense/i)).toBeTruthy();
    await user.click(within(dlg).getByRole("button", { name: /confirm payment/i }));
    await waitFor(() => expect(within(screen.getByText("Ramzan Cook").closest("tr")).getByText("paid")).toBeTruthy(), { timeout: 10000 });

    // 5) payslip is a real PDF
    await user.click(screen.getByRole("button", { name: /download payslip ramzan cook/i }));
    await waitFor(() => expect(clicked.length).toBe(1), { timeout: 10000 });
    expect(clicked[0]).toMatch(/payslip-Ramzan-Cook-\d{4}-\d{2}\.pdf/);
    expect(Buffer.from(await created[0].arrayBuffer()).slice(0, 5).toString()).toBe("%PDF-");

    // 6) the cook's salary shows up as a mess expense
    const warden = await apiAs("warden");
    const exp = await warden("GET", `/mess-finance/expenses?month=${new Date().toISOString().slice(0, 7)}&category=staff`);
    expect(exp.data.items.some((e) => /Ramzan Cook/.test(e.description) && e.source === "payroll")).toBe(true);
  });

  it("the monthly report includes the new mess, maintenance and payroll figures", async () => {
    await loginAs("warden");
    open("/admin/reports");
    const user = userEvent.setup();
    fireEvent.change(await screen.findByLabelText(/report month/i), { target: { value: new Date().toISOString().slice(0, 7) } });
    await user.click(screen.getByRole("button", { name: /generate report/i }));
    const report = await screen.findByTestId("report", {}, { timeout: 15000 });
    expect(within(report).getByText("Mess spending")).toBeTruthy();
    expect(within(report).getByText("Mess cost per meal")).toBeTruthy();
    expect(within(report).getByText("Maintenance jobs done")).toBeTruthy();
    expect(within(report).getByText("Salaries paid")).toBeTruthy();
  });
});
