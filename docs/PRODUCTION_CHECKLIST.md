# Production configuration checklist (Render + Vercel)

No step below asks you to reveal a secret value. Anything that needs Render access
is marked **[Render]**; everything marked **[Verified in code]** was checked by reading
the repository and (where stated) by automated tests — it says nothing about what is
actually configured in your live services.

## A. Verified in code (no Render access needed)

| Fact | Where |
|---|---|
| The server reads exactly these variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` (optional, default 7d), `FRONTEND_ORIGIN`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `BACHS_SECRET_KEY`, `BACHS_WEBHOOK_SECRET`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` (optional), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `NODE_ENV`, `PORT` (set by Render) | grep of `process.env` in `server/src`, `schema.prisma` |
| If `FRONTEND_ORIGIN` is unset the server falls back to `https://med-ai-3.vercel.app` | `server/src/config/frontendOrigin.js` |
| CORS allows only: the comma-separated `FRONTEND_ORIGIN` value(s), that production fallback, and `localhost:5500` / `127.0.0.1:5500`. Anything else gets a 403. Requests with no `Origin` header (webhooks, curl) are not CORS-checked | `frontendOrigin.js`, `index.js`; tested in `tests/app-smoke.test.js` |
| `FRONTEND_ORIGIN` is also used for Google-OAuth redirects, payment redirects and the therapy links — a wrong value breaks sign-in redirects as well as CORS | `auth.js`, `payments.js`, `therapy.js` |
| A **trailing slash** or a path in `FRONTEND_ORIGIN` will never match a browser's `Origin` header and silently blocks the site | CORS exact-match comparison |
| Missing `JWT_SECRET` → login cannot work; missing `BACHS_WEBHOOK_SECRET` → every payment webhook is rejected (401) so paying users are never upgraded; missing `BREVO_API_KEY`/`BREVO_FROM_EMAIL` → reset codes are not emailed; missing both AI keys → AI returns 503; missing `GOOGLE_*` → Google sign-in returns 503 and nothing else is affected | handlers; tested for webhook + Google 503 |
| `npm start` runs `prisma migrate deploy` before the server starts; it needs `DIRECT_URL` | `server/package.json` |
| The login page and every other page default to `https://medai-backend-5r9o.onrender.com` unless `localStorage.medai_api_base_url` overrides it | `*.html`, `dashboard.js` |

**Cannot be verified from code:** whether any variable is actually set in Render, whether keys are valid with their providers, what the Vercel domain really is, Google Cloud Console redirect URIs, Brevo sender verification, Bachs webhook registration.

## B. Needs access to Render / Vercel / provider dashboards

### B1. Variables present — without displaying values
1. **[Render]** Service → **Shell** → run: `cd server && node scripts/check-env.js`  
   It prints `SET / MISSING / PROBLEM` per variable and **never prints a value**. It checks format only (e.g. `FRONTEND_ORIGIN` has no trailing slash, `JWT_SECRET` is ≥32 chars, `GOOGLE_CALLBACK_URL` ends in `/api/auth/google/callback`). Exit code 1 = a required variable is missing/malformed.
2. If the Shell isn't available on your plan: Service → **Environment** — confirm each name in the list in section A exists. Do not screenshot values; names only.

### B2. `FRONTEND_ORIGIN` specifically
1. **[Vercel]** Open the project → Domains. Note the exact production domain you actually serve users from (including any custom domain).
2. **[Render]** Confirm `FRONTEND_ORIGIN` equals that origin exactly: `https://…`, no trailing `/`, no path. If you serve from two domains, comma-separate them.
3. From any terminal (no secrets involved) confirm CORS accepts your site and rejects others:
   ```
   curl -si -H "Origin: https://YOUR-SITE" https://medai-backend-5r9o.onrender.com/api/health | grep -i access-control-allow-origin
   curl -si -H "Origin: https://not-your-site.example" https://medai-backend-5r9o.onrender.com/api/health | head -1     # expect 403
   ```
   First should echo your origin; second should be `HTTP/2 403`.

### B3. Other dashboards
- **[Render]** Start Command is `npm start` (not `node src/index.js`), and the latest deploy log shows migrations applied with no errors.
- **[Render]** `NODE_ENV=production`.
- **[Google Cloud]** The authorised redirect URI equals `GOOGLE_CALLBACK_URL` exactly.
- **[Brevo]** `BREVO_FROM_EMAIL` is a verified sender; IP restrictions don't block Render.
- **[Bachs]** Webhook points to `https://<backend>/api/payments/webhook` and its signing secret equals `BACHS_WEBHOOK_SECRET`.
- **[Render logs]** After deploy, `GET /api/health` returns `{ ok: true, database: "connected" }`.

### B4. Rotate anything that has been exposed
- The old admin password that was hard-coded in `admin.html` / `Login_page.html` has been in the public repo history since the first commit. Treat it as compromised: **change the real admin account's password** (Admin → Settings → Change password, or "Forgot password"), and change it anywhere else you reused it. Removing the text from the code does not remove it from git history.
- Rotating `JWT_SECRET` signs everyone out (acceptable, and recommended if you ever pasted it anywhere).
