# Scrollwise Backend

## Local development

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Run the TypeScript compiler in watch mode:
   ```powershell
   npm run dev
   ```
3. To create a production build locally:
   ```powershell
   npm run build
   ```
   Then launch the compiled server from `dist/`:
   ```powershell
   npm run start
   ```
   > `npm run start` now just runs `node dist/index.js`. If you want to rebuild and immediately boot the compiled server in one step, use `npm run start:build`.

## Deploying on Render

Render executes two separate phases:

- **Build command** – `cd backend && npm install && npm run build`
- **Start command** – `cd backend && npm run start`

Because the Build phase already emits `dist/index.js`, the Start phase **must not** trigger another full TypeScript compilation or the instance will quickly exceed the 512 MB memory limit. The current `start` script simply runs `node dist/index.js`, so Render can boot instantly without exhausting memory.

If you change the scripts, keep this contract intact:

- `npm run build` should only compile TypeScript
- `npm run start` should only execute the already-built JavaScript

For troubleshooting Render deployments:

1. Confirm the Build tab succeeded (artifacts uploaded).
2. If the service exits with status 134 or "heap out of memory", verify the start script isn’t re-running the compiler.
3. You can temporarily set `NODE_OPTIONS=--max-old-space-size=512` in Render’s environment only if long-running scripts need additional headroom, but it shouldn’t be necessary with the streamlined start command.

## Email + OTP configuration

Email-based OTP flows now use [Brevo (Sendinblue) transactional email](https://www.brevo.com/). Configure the following environment variables (see `.env.example`):

- `BREVO_API_KEY` – Create an API key in Brevo under SMTP & API → Create a new key. Use the “Transactional” scope.
- `BREVO_FROM_EMAIL` – The verified sender email in Brevo (verify it in Brevo → Senders & IPs → Domains/Senders).
- `BREVO_FROM_NAME` – Friendly display name. Default: `Scrollwise`.
- `BREVO_TIMEOUT_MS` – Optional request timeout (default 15000 ms). Increase only if your region has high latency to Brevo’s API.

Setup checklist:

1. Sign up for Brevo, validate your sending domain or single sender.
2. Generate an API key and store it in your deployment platform as `BREVO_API_KEY` (never commit it).
3. Redeploy/restart the backend. The first email send will fail loudly if the key or sender is invalid, with the Brevo error code logged.

If you prefer another email provider, adapt `src/utils/mailer.ts` accordingly (it only depends on axios and expects a `sendMail` function that resolves when delivery is accepted).

## Admin and superadmin accounts

- Set `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` to reserve a specific email as the super administrator. When that user registers or signs in, their role is automatically upgraded to `superadmin`.
- Provide a comma-separated `ADMIN_EMAILS` list to grant standard admin privileges to additional accounts without manual database edits. The role is applied the next time those users authenticate.

After updating these variables, redeploy the backend (or restart locally) so new sign-ins pick up the role assignments.

## Resetting all user data

Need to wipe every user-related collection and bootstrap a fresh admin account? Use the bundled script:

```powershell
npm run reset:users
```

The script will:

- Connect to the MongoDB instance configured via `MONGODB_URI`.
- Delete **all** documents from `User`, `Session`, `TrackingEvent`, `DailyMetric`, `Insight`, `Audit`, `ContactMessage`, `Policy`, and `OtpCode` collections.
- Seed a brand-new admin account with:
   - Email: `tryreverseai@gmail.com`
   - Password: `hArrYPOTTER@4`

Run it only in environments where it is safe to drop every user record. The admin credentials can be changed later via the standard password-update flows or by editing `src/scripts/resetUsers.ts` before executing the script.
