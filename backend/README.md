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
