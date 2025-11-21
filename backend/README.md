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

Email-based OTP flows require an SMTP account. Provide the following environment variables (see `.env.example`):

- `SMTP_HOST`, `SMTP_PORT`
- `SMTP_USERNAME`, `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- Optional tuning knobs: `OTP_TTL_MINUTES`, `OTP_THROTTLE_PER_HOUR`, `OTP_MAX_ATTEMPTS`

For local testing you can use a Gmail SMTP account (remember to create an App Password) or any transactional email provider that supports SMTP. Once configured, the API will send OTP codes for signup verification and password resets automatically.

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
