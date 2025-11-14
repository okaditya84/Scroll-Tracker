# Scrollwise

Scrollwise is a full-stack wellbeing companion that transforms unstructured scrolling into playful, actionable insights. The solution is composed of:

- **Chromium extension** that captures scroll, click, idle and focus events across all tabs.
- **Next.js web experience** for onboarding, dashboards, insights and account management.
- **Node.js API** with MongoDB, JWT sessions, Google OAuth and Groq-powered insight generation.

## Monorepo layout

```
backend/   # Express + TypeScript API service
web/       # Next.js marketing site + app router dashboard
extension/ # React + Vite MV3 browser extension
```

## Quick start

1. Install dependencies per package:
   ```powershell
   cd backend; npm install
   cd ../web; npm install
   cd ../extension; npm install
   ```
2. Duplicate `.env` from the root example (see below) into `backend/.env` and `web/.env.local`. Update secrets accordingly.
3. Run the API:
   ```powershell
   cd backend
   npm run dev
   ```
4. Run the web app:
   ```powershell
   cd web
  npm run dev
   ```
5. Run the extension in watch mode and load the unpacked `extension/dist` folder into Chrome:
   ```powershell
   cd extension
   npm run dev
   ```

## Environment variables

Populate the following environment variables (replace placeholders with your values):

```
# backend/.env
NODE_ENV=development
PORT=3000
MONGODB_URI=...
JWT_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_TTL_DAYS=30
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GROQ_API_KEY=...
FRONTEND_URL=http://localhost:3001
EXTENSION_URL=chrome-extension://<extension-id>
EXTENSION_URLS=
CORS_ADDITIONAL_ORIGINS=

# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_EXTENSION_URL=chrome-extension://<extension-id>

# extension/.env (optional for build convenience)
VITE_API_URL=http://localhost:3000/api
VITE_WEB_URL=http://localhost:3001
```

## Admin access & roles

- Seed a super admin account by setting `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` in `backend/.env`. The server elevates or creates that user on boot.
- Sign in with those credentials through the web login page. Admins are redirected to `/admin`, and elevated controls are also reachable from the dashboard via the “Admin console” button.
- Admin pages cover the overall summary (`/admin`) plus user management (`/admin/users`). All other accounts stay on `/dashboard`.
- Logging out from either the web app or extension now clears the session everywhere, so elevated consoles stay protected.

## MongoDB schema

- `users`: credentials, google profile, habits and avatar.
- `sessions`: refresh token hashes, device metadata, TTL-based cleanup.
- `trackingevents`: granular scroll/click/idle/focus entries with metadata.
- `dailymetrics`: per-day aggregates enabling charts/streaks.
- `insights`: stored Groq completions for recent insights/history.

## Security & privacy safeguards

- Refresh tokens are hashed and rotated on each use.
- API enforces CORS allowlist for the hosted web + extension origins.
- Request throttling, helmet hardening and structured logging are baked in.
- Groq prompts only ship anonymised, aggregated statistics.
- Extension stores tokens in `chrome.storage` and respects pause/resume control.

## Deployment suggestions

- **API**: Deploy to Render, Railway or Fly.io (Dockerfile provided in future step). Set environment variables, configure health check `/health`.
- **Web**: Deploy Next.js app to Vercel. Configure environment variables, enable edge caching for marketing routes.
- **Extension**: Build with `npm run build` and upload `extension/dist` to the Chrome Web Store dashboard. Capture store listing assets from the design system.

## Future enhancements

- Weekly email digest summarising insights.
- Social share cards for notable streaks.
- Desktop notifications for break reminders.
- Team dashboard for aggregated wellbeing metrics.

---

See the detailed product & engineering plan in the project documentation or ask Copilot for more scenarios.
