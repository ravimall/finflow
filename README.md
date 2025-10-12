# FinFlow Phase-1

Backend for FinFlow Phase-1: Customer Booking & Loan Tracking App.

## Quick start (development)

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
    npm install
3. Start server:
    npm run dev

## Notes
- Dropbox credentials must be set via environment variables and never committed to source control.
- Database schema is available at `database/schema.sql`.
- Always run Sequelize migrations during deployment; `sequelize.sync()` is disabled in production to avoid destructive schema changes.
- The Documents page previously crashed in production due to an eager `framer-motion` import creating a temporal dead-zone cycle; the animation bindings now load lazily to prevent the issue.
