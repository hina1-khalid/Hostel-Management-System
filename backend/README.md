# Hostel Management — Backend API

Express + Mongoose. See the root README for setup. Health check: `GET /api/health`.

Modules (all under `/api`): `auth` · `hostels` · `rooms` · `students` · `fees` · `complaints` · `qr-entries` · `attendance` · `leaves` · `visitors` · `notices` · `notifications` ·
`dashboard` · `inventory` · `mess` · `laundry` · `chatbot` · `search`.

Responses are plain JSON (arrays/objects); errors are `{ "message": "..." }` with a proper HTTP status.
Auth: `Authorization: Bearer <token>` from `POST /api/auth/login`.

```bash
npm run dev      # nodemon
npm run seed     # demo data (empty DB only; add `-- --force` to wipe first)
node tests/api.test.js
```
