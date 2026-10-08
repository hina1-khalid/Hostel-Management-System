# Smart Hostel Management System

[![CI](https://github.com/hina1-khalid/Hostel-Management-System/actions/workflows/ci.yml/badge.svg)](https://github.com/hina1-khalid/Hostel-Management-System/actions/workflows/ci.yml)

A full-stack web application that digitises everyday hostel operations: rooms and students, fees, complaints, leave, visitors, QR gate passes, mess, laundry, inventory and staff payroll. It has four user roles (super admin, warden, student, security guard) and an AI assistant.

**Tech stack:** React 18 · Vite · Tailwind CSS · Node.js · Express · MongoDB (Mongoose) · JWT · Zod · Docker · GitHub Actions

## Highlights

- **Role-based access control** with hostel-level scoping: wardens only see and change their own hostel.
- **Room allocation** with live occupancy, gender checks, room change requests and a waiting list.
- **QR gate system:** camera scanning, late-entry detection and leave gate passes.
- **Finance:** fee generation, receipts as PDF, mess cost analysis (cost per meal, profit/loss) and worker payroll with payslip PDFs.
- **AI features:** chatbot and monthly report using the Claude API, with a rule-based fallback so everything works without an API key.
- **Security:** hashed passwords, Helmet, rate limiting, input validation (Zod), audit log, protection against IDOR and mass-assignment.
- **Quality:** automated backend API tests and frontend UI tests, Swagger API docs, Docker Compose and a GitHub Actions CI pipeline.
- **Installable (PWA)** and Excel export for reports.

## Screenshots

<!-- Add 3 to 4 screenshots here (login, admin dashboard, student view, QR scanner). Example:
![Admin dashboard](docs/screenshots/dashboard.png)
-->

## Quick start

You need **Node.js 18+** and a MongoDB database (free MongoDB Atlas M0 cluster, or a local MongoDB).

```bash
# 1) Backend
cd backend
npm install
cp .env.example .env        # then edit .env: set MONGO_URI and JWT_SECRET
npm run seed                # loads demo data (only if the DB is empty; use `npm run seed -- --force` to wipe & reload)
npm run seed:extras         # optional: sample maintenance jobs, mess stock/expenses, workers and last month's salaries (adds, never wipes)
npm run dev                 # API on http://localhost:5000

# 2) Frontend (new terminal)
cd frontend
npm install
cp .env.example .env        # optional: change VITE_API_URL if the backend is elsewhere
npm run dev                 # App on http://localhost:5173
```

### Demo accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@hostel.com | Admin@123 |
| Warden (Iqbal Hostel only) | warden@hostel.com | Warden@123 |
| Security guard | guard@hostel.com | Guard@123 |
| Student (has a room) | ali@student.com | Student@123 |

Other students: hamza, usman, ayesha, sana `@student.com` (same password). `bilal@student.com` has no room yet (good for testing allocation).
**Change or delete these accounts before deploying.**

### MongoDB Atlas in 2 minutes
1. Create a free cluster → Database Access: add a user → Network Access: allow `0.0.0.0/0` (or your IP).
2. Connect → Drivers → copy the connection string into `MONGO_URI` (replace `<password>`, keep `/hostel_management` as DB name).

## Roles

| Role | Can do |
|---|---|
| **superadmin** | Everything, across all hostels (create hostels, wardens, guards) |
| **admin (warden)** | Everything inside *their own* hostel (rooms, students, fees, attendance, leave, complaints, mess, laundry, inventory, notices, security guards) |
| **student** | Own room/QR gate pass, fees, attendance, complaints, leave, visitors approval, mess booking/feedback/bills, laundry booking, notices, chatbot |
| **security** | Scan gate QR (entry/exit, late-entry flag), register/check-in/check-out visitors, entry logs |

## Features

Hostels · Rooms (live occupancy) · Students (account + profile, allocate/vacate with gender check) · Fees (manual, monthly generator, receipts, auto-overdue) ·
Complaints (auto category/priority, assignment, comments) · QR gate entries · Attendance (roll-call sheet) · Leave · Visitors ·
Notices · Notifications (bell) · Dashboard charts · Inventory · Mess (menu, meal booking, feedback, bills) · Laundry (machines, slots, bookings) ·
AI chatbot (Claude if `ANTHROPIC_API_KEY` is set, otherwise a built-in rule-based assistant) · Global search · Staff management ·
**Camera QR scanning** at the gate · **Leave gate pass** (QR for approved leaves) · **PDF fee receipts** · **Excel export** (students, fees, attendance, complaints, mess bills) ·
**AI monthly report** (Claude-written or rule-based, saved history, print/PDF) · **Email notifications** (SMTP) · My Profile (details, password, email opt-out) ·
**Forgot password** (emailed link, 30 min, single use) · **Complaint photos** (up to 3, validated by file contents) ·
**Room change requests + waiting list** · **Audit log** (superadmin) · **Pagination & search** · **Input validation (Zod)** ·
**Swagger API docs** · **Installable app (PWA)** · **Docker** and **GitHub Actions CI** ·
**Maintenance schedule** (repeating jobs + automatic reminders) · **Mess expenses, stock and cost analysis** (cost per meal, profit/loss) ·
**Payroll** (worker attendance, salaries, payslip PDFs).

### Camera QR scanning
Security → *Gate Scanner* → **Scan with camera**. Works on `http://localhost` or any `https://` site (browsers block cameras on plain http over a network).
Students show their QR from *My Room & QR*. Allow camera permission when the browser asks.

### Forgot password
*Sign in → Forgot password?* sends an emailed link (needs SMTP, see below). Only a hash of the token is stored, the link works once for 30 minutes,
and the answer is identical for unknown emails. Without SMTP the link is printed in the backend console (handy for local testing).

### Email notifications (optional)
Every in-app notification can also be emailed (fee due, payment received, leave decision, complaint update, late entry, notices…).
Set these in `backend/.env` and restart the backend; leave `SMTP_HOST` empty to keep email off.
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASS=<Google App Password>      # Google Account → Security → 2-Step Verification → App passwords
MAIL_FROM="Hostel Management <yourname@gmail.com>"
```
Then open **My Profile → Send me a test email**. Each user can switch email off in My Profile.

### Leave gate pass
When the warden approves a leave, the student gets a **Gate pass** button (My Leave) showing a QR for that leave. The guard scans it at the gate:
it is accepted only if the leave is approved and today is inside the leave dates, and returning on the pass is never marked "late".

### Room change requests and waiting list
Students with a room can ask for another one; students without a room join their hostel's **waiting list** (first come, first served).
Wardens review both under *Room Requests*. When a bed is freed, wardens are notified if somebody is waiting.

### Audit log
Superadmin → *Audit Log*: every successful create/update/delete and every sign-in (who, what, when, from which IP). Passwords and tokens are never stored; entries expire after 180 days.

### Maintenance schedule
*Maintenance*: repeating jobs such as "Service all ACs every 90 days". Each job shows overdue / due soon / on schedule. **Mark done** logs the date, cost and notes
and schedules the next date automatically. A background job runs hourly and sends wardens one notification (and email) per day for jobs that are due within 3 days or overdue.

### Mess expenses, stock and cost analysis
Inside *Mess* there are three extra tabs:
- **Expenses**: groceries, meat, gas… per month (Excel export). Stock purchases and paid cooks' salaries are added automatically.
- **Stock**: rice, flour, oil, gas cylinders. *+ In* (with the price paid), *Use*, *Count* (stock-take) and a full history. Wardens get a notification when stock falls to its alert level.
- **Cost analysis**: total spent, meals served, **cost per meal**, billed to students, **surplus or loss**, a 6-month chart and a breakdown by category.

### Payroll (hostel workers)
*Payroll* is for people who do **not** log in (cook, cleaners, guards). Add workers, mark only the exceptions in *Daily attendance* (everyone counts as present otherwise),
then press *Calculate / refresh salaries*. Rules: absent = 1 day cut, half day = ½ day, leave = free for the first 2 days a month (`PAID_LEAVES_PER_MONTH`), then cut;
someone who joined mid-month is paid from that day. Add a bonus or an advance, mark as paid, and download a **payslip PDF**. A cook's salary (workers marked "count as a mess cost") is added to the mess expenses.

### AI monthly report
Admin → *Monthly Report* → pick a month → **Generate report**. With `ANTHROPIC_API_KEY` set, Claude writes the summary, highlights, concerns and
recommendations from the month's numbers; without it (or if the API fails) the same sections are produced by built-in rules, so it always works.

## Project layout

```
backend/
  server.js  seed.js  .env.example
  config/db.js
  middleware/   authMiddleware.js  errorHandler.js
  models/       User Hostel Room Student Fee Complaint QrEntry Attendance Leave Visitor Notice
                Notification Inventory Mess(4 models) Laundry(3 models)
  controllers/  one per module (logic)        routes/  one per module (URL + role rules)
  utils/        helpers.js (scoping, ownership, dates)  notify.js  generateToken.js
  tests/run-all.js       ← `npm test`: starts the API and runs every suite below on a freshly seeded database
  tests/api.test.js      ← 145 end-to-end API checks
  tests/features2.test.js← 83 checks: audit, validation, photos, pagination, room requests, leave pass, API docs
  tests/ops.test.js      ← 109 checks: maintenance, mess expenses/stock/analysis, workers, attendance, payroll, payslips
  tests/scheduler.test.js← 10 checks of the daily maintenance reminders (time-travel)
  tests/reset.test.js    ← 18 checks of password reset with a real local SMTP server
  tests/email.test.js    ← 8 checks of email notifications
  tests/report.test.js   ← 15 checks of the AI-report logic (Claude API is mocked)
  services/ validation/ docs/   ← bed allocation + payroll rules · Zod schemas · OpenAPI generator
  utils/scheduler.js     ← background reminders
frontend/
  src/App.jsx  main.jsx  index.css
  src/api/axios.js   src/context/AuthContext.jsx   src/hooks/   src/utils/
  src/components/  Layout, NotificationBell, GlobalSearch, ChatbotWidget, DataTable, Badge, ui kit…
  src/pages/  admin/ (15 pages)  student/ (10)  security/ (2)  Login  Register
  src/__tests__/smoke.test.jsx   ← 79 UI checks against the live backend (camera is mocked)
```

## Running the tests

```bash
cd backend && npm test                                    # → 388 checks in 7 suites (starts its own API; WIPES the database in MONGO_URI)
cd backend && npm run seed -- --force && npm run dev      # then, for the UI tests, keep the API running...
cd frontend && npm test                                   # → 79 UI checks (needs the API running with fresh demo data, without seed:extras)
```
Run tests only against a throw-away database: the API test creates and deletes records.

## What changed vs. the old code (bugs fixed)

**Security**: wardens could create superadmins · any student could read other students' fees/profile/complaints (IDOR) ·
wardens could see/modify other hostels · update endpoints accepted arbitrary fields (mass assignment) ·
added helmet, login/register rate limiting, deactivated-account blocking.
**Logic**: dashboard `?hostel=` filter returned wrong data · re-allocating to the same room double-counted beds ·
vacating/re-allocating could mark maintenance rooms "available" · deleting a student left the bed occupied ·
fees never became overdue · visitor decisions could be changed after check-in · late-entry used server time (now `APP_TIMEZONE`, default Asia/Karachi) ·
leave requests could overlap · bad IDs returned 500 (now 400).
**Frontend**: wrong-password message vanished (page reloaded on 401) · many sidebar links led to the wrong page · missing Register page ·
warden saw a Hostels button that returned 403 · API URL is now configurable (`VITE_API_URL`).

## Notes / next steps

* **Project history:** this project was rebuilt after a laptop data loss. The Phase 1–6 backend and the v5 frontend were recovered from backups; Notifications, Inventory, Mess, Laundry, AI Chatbot, Global Search and the remaining frontend pages were re-created, and known bugs in the old code were fixed (see above).

* The gate scanner supports the device camera, a USB/Bluetooth scanner, or manual entry.
* Not implemented: SMS, online payments, dark mode.
* Run `npm run seed:extras` only for demos: the backend tests expect the plain demo data.
* The Claude-written report and chatbot were tested with a mocked API (parsing, fallback, request format); try them once with your own `ANTHROPIC_API_KEY`.
* For production: set a strong `JWT_SECRET`, restrict `CLIENT_URL`, serve the frontend build (`npm run build`) from a static host, and use HTTPS.

## API documentation
Open **http://localhost:5000/api/docs** (Swagger UI). It is generated from the real routes, so it is always in sync, and lists the roles allowed on every endpoint.
Press **Authorize**, paste the `token` from `POST /api/auth/login`, and try the endpoints. Raw spec: `/api/docs.json`.

## Run everything with Docker (optional)
```bash
cp .env.example .env          # set JWT_SECRET (and optional SMTP / ANTHROPIC_API_KEY)
docker compose up --build     # app http://localhost:8080 · API http://localhost:5000
docker compose run --rm backend npm run seed     # first time only: demo data
```
> The Docker build is also checked by the GitHub Actions workflow on every push.

## Continuous integration
`.github/workflows/ci.yml` runs on every push: backend tests (against a real MongoDB), frontend build + UI tests, and a Docker build.

## Installable app (PWA)
In Chrome/Edge (or "Add to Home screen" on a phone) the production build can be installed like an app. Private data (the API) is never cached by the service worker.
