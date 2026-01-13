INVESTIGATION #1

Here’s a clear summary of your remote environment setup based on the terminal session:

⸻

🧩 Overall Environment
	•	Server OS: Ubuntu 25.04 (Linux 6.14.0-33)
	•	App location: /var/www/configurator/Curtain-Wizard/
	•	Frontend project: apps/web (Next.js 15.5.2)
	•	Node version: 20.18.1
	•	Process owner: root user, running Node as user zaslony

⸻

⚙️ Runtime Configuration
	•	Current mode: development (next dev --turbopack -p 3010)
	•	No Docker, no PM2 app running, no systemd service.
	•	Nginx is active and listening on ports 80 / 443, likely proxying to localhost:3010.
	•	Build directory: apps/web/.next
	•	Loaded env file: apps/web/.env.local (used only in dev mode).
	•	Environment variables: none injected globally — only runtime npm and Node vars are visible in /proc/$PID/environ.
	•	NODE_ENV=development, meaning this is not a production build (hence stale UI, different behavior).

⸻

🤖 AI / Backend Services
	•	Local segmentation service: expected at http://127.0.0.1:8000, but not running → falls back to HuggingFace (slow).
	•	No local inference or measurement service detected on port 8000.

⸻

💡 TL;DR

Your remote server is currently running the Next.js dev server directly under Node (no process manager, no Docker).
It’s using development env vars from apps/web/.env.local.
There’s no production build or deployed segmentation backend.
Nginx is simply proxying traffic to the dev server on port 3010.

⸻

✅ Next step:
Switch to a proper production setup:
	1.	Create apps/web/.env.production with correct keys.
	2.	Run NODE_ENV=production npm run build && npm run start.
	3.	Optionally manage it via PM2 or systemd.
	4.	Bring up segmentation backend on port 8000

⸻

INVESTIGATION #2

# Findings
- **Mode mismatch**: [docs/REMOTE-ENV-STATUS.md](cci:7://file:///Users/mario/Repo/Curtain%20Wizard/docs/REMOTE-ENV-STATUS.md:0:0-0:0) shows the remote app running `next dev` under Node/Turbopack with `NODE_ENV=development`, so even after updating `apps/web/.env.local` you’ll keep seeing the “old” dev build. Production behaviour (`next build && next start`) is never executed.
- **Process management gap**: No `pm2` or systemd service is active. Nginx simply proxies to the dev server on port 3010, so any reboot or crash would kill the site.
- **Segmentation backend offline**: The expected `LOCAL_SEG_URL=http://127.0.0.1:8000/segment` fails because no FastAPI service is running, forcing Hugging Face fallback.

# Recommended Actions
- **[env alignment]** Ensure `apps/web/.env.production` contains the production values you want, then copy it over `.env.local` only if you keep running dev mode temporarily. I previously outlined the safe `cp`/`scp` steps.
- **[switch to prod build]** From `/var/www/configurator/Curtain-Wizard/` run:
  ```bash
  npm -w apps/web run build          # produces .next with production assets
  NODE_ENV=production npm -w apps/web run start
  ```
  For permanence, wrap these commands in a PM2 script (see below).
- **[add PM2 ecosystem]** Create `/var/www/configurator/Curtain-Wizard/ecosystem.config.js` with something like:
  ```js
  module.exports = {
    apps: [{
      name: 'cw-web',
      cwd: '/var/www/configurator/Curtain-Wizard/apps/web',
      script: 'npm',
      args: 'run start',
      env: { NODE_ENV: 'production' },
      env_production: { NODE_ENV: 'production' }
    }]
  };
  ```
  Then run `pm2 start ecosystem.config.js --env production` followed by `pm2 save` so it restarts on boot.
- **[segmentation service]** Confirm how the local Mask2Former server should start (Docker, python env, etc.). Launch it (e.g., `uvicorn services.segmentation.main:app --host 127.0.0.1 --port 8000`) and verify with `curl 127.0.0.1:8000/device`. Once it responds, the web app will stop hitting Hugging Face.
- **[security cleanup]** Rotate any exposed API keys and update `apps/web/.env.production` after the rotation. Keep [docs/REMOTE-ENV-STATUS.md](cci:7://file:///Users/mario/Repo/Curtain%20Wizard/docs/REMOTE-ENV-STATUS.md:0:0-0:0) as a living status log.

# Next Steps
- **Confirm env copy** is complete (backup done, `.env.production` up to date).
- **Switch staging to production mode** using build + PM2 commands above; let me know once you’re ready and I can walk through the exact PM2 setup.
- **Start segmentation backend** and test `/segment` locally from the server.
- **Update docs** ([docs/REMOTE-ENV-STATUS.md](cci:7://file:///Users/mario/Repo/Curtain%20Wizard/docs/REMOTE-ENV-STATUS.md:0:0-0:0), `docs/RUNBOOK.md`) once the new process is in place so future maintenance is clear.

I followed the “Rules of engagement” memory while preparing these steps. When you’re ready to execute the PM2 or segmentation commands, I can provide the copy-paste snippets.