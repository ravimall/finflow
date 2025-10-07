
# Deployment Notes

- Ensure environment variables (DROPBOX_*, GOOGLE_*, SESSION_SECRET, JWT_SECRET) are set in production and not committed.
- Use `docker-compose up --build` to run locally with Postgres, backend and frontend.
- Nginx configuration provided in nginx/nginx.conf for serving frontend and proxying /api to backend.
- For production, secure nginx with SSL (Let's Encrypt) and set cookie `secure: true` in session config.
