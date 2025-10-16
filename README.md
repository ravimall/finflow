# FinFlow Phase-1

Backend for FinFlow Phase-1: Customer Booking & Loan Tracking App.

## Quick start (development)

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
    npm install
3. Start server:
    npm run dev

## Health check endpoint for cron jobs

Automated uptime pings (including the scheduled GitHub Action in this repository) should call the backend health probe:

| Method | Path      | Description                    | Query/Body params |
| ------ | --------- | ------------------------------ | ----------------- |
| `GET`  | `/health` | Returns `ok` in plain text for liveness checks. | _None required_ |

When deployed, append `/health` to the backend base URL. If the base URL is provided via the `API_BASE_URL` environment variable, the fully qualified endpoint becomes `${API_BASE_URL}/health` (after trimming any trailing slash). Run `npm run print:health:url` to print the URL derived from `.env.production` or `.env`.

## Notes
- Dropbox credentials must be set via environment variables and never committed to source control.
- Dropbox folder management now relies on immutable Dropbox folder IDs. Set `FEATURE_USE_FOLDER_ID=false` only if you must roll back to the legacy path behaviour temporarily.
- Database schema is available at `database/schema.sql`.
- Always run Sequelize migrations during deployment; `sequelize.sync()` is disabled in production to avoid destructive schema changes.
- The Documents page previously crashed in production due to an eager `framer-motion` import creating a temporal dead-zone cycle; the animation bindings now load lazily to prevent the issue.
- Frontend builds read the backend base URL from `VITE_API_URL`; configure it in `frontend/.env` or rely on the Render fallback defined in `frontend/src/config.js`.
- Use `npm run --prefix backend check:cors` to verify CORS preflight responses locally before deploying.
- Run `npm run --prefix backend backfill:dropbox` after deploying the migration to populate `dropbox_folder_id` and refresh Dropbox sharing state.
