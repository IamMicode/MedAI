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

## C. Manual production checks for the 2FA / Premium / age changes
(All automated tests use mocked services; none of this has been run against live Google, Bachs, Render or the real DB.)

1. **Google + 2FA:** with a real test account that has 2FA on, sign in with Google → expect the 2FA code prompt, no dashboard until the code is accepted. Repeat with a backup code. Then a Google account without 2FA → straight in.
2. **Premium expiry:** find users with `plan='Premium'` AND `premiumExpiresAt IS NULL` (read-only query). These now get Free benefits. If any are legitimate (manual grants), set an expiry for them deliberately before deploying.
3. **Premium lapse/renewal:** with a Bachs sandbox payment, confirm the plan shows Premium; set that user's `premiumExpiresAt` to the past in a staging DB and confirm the 10/day AI cap and Free plan label apply; pay again and confirm it returns.
4. **Existing patients without DOB:** sign in (password and Google) and confirm the DOB prompt appears, under-18 is refused, valid DOB completes sign-in.
5. `admin1.html` was removed (no references); confirm `/admin1.html` is no longer needed in any bookmarks/Vercel dashboard rules.

## D. Deploy notes for the hardening round (webhook idempotency, 2FA limits, typed tokens)
(Automated tests use mocked services and an in-memory database; none of this has run against Render, Postgres, Bachs or Google.)

1. **Migration `20261011150000_two_factor_replay_and_attempt_limits`** — additive only: three new columns on `"User"` (`twoFactorLastStep` INTEGER NULL, `twoFactorAttempts` INTEGER NOT NULL DEFAULT 0, `twoFactorWindowEndsAt` TIMESTAMP(3) NULL). No data is changed or dropped; existing rows get NULL / 0. It runs via `npm start` (`prisma migrate deploy`). **What was verified:** all 18 migrations (including this one) apply cleanly, in order, to a scratch PostgreSQL 16 database; a column-by-column comparison of the resulting tables against `schema.prisma` (173 scalar fields, 17 models: names, types, nullability, datetime precision, numeric/boolean defaults) found no differences, and the same comparison flags the three columns as missing on a database without this migration; applying it to a database that already contains a user row worked. **What was NOT verified:** `prisma migrate deploy`, `prisma migrate diff` and `prisma validate` could not run (Prisma's engine binaries cannot be downloaded in the dev sandbox), so Prisma's own drift check and its `_prisma_migrations` bookkeeping were not exercised. Before deploying, run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <scratch db>` (expect an empty diff) and `npx prisma migrate status` against a staging copy. Deploying the code without the migration breaks 2FA sign-in, so ship them together.
2. **Typed access tokens (`typ: 'access'`).** Sessions issued before this deploy have no `typ`. They are accepted only if issued *before* the legacy cutoff, which defaults to the moment the new server process starts, so nobody is logged out and the exception expires by itself within `JWT_EXPIRES_IN` (7 days). Optional env var `ACCESS_TOKEN_LEGACY_CUTOFF` (ISO date): pin the cutoff, or set `1970-01-01` to refuse every untyped token at once (forces everyone to sign in again). An unparseable value fails closed. Tokens minted by an old instance *after* the new one starts (rolling deploy) are rejected → that user signs in again.
3. **Legacy sessions without a date of birth:** protected routes answer `403 {code:'DOB_REQUIRED'}`; the dashboard shows a prompt that posts to `POST /api/auth/complete-dob`. Tokens without the `dobOk` claim cost one extra DB read per request until they expire.
4. **Webhook responses:** `200` once an event is fully handled (including duplicates, unknown payments, ignored types); `500` only on an unexpected error so Bachs redelivers. **Unverified:** Bachs' retry schedule/limits for non-2xx responses — confirm in their dashboard/docs.
5. **Doctor sign-in/registration limits** use the client IP from `trust proxy = 1` (Render's single proxy hop). Confirm in production that `req.ip` is the real client IP, not the load balancer's: send two requests from different networks and check they do not share a 429.
6. Manual checks: concurrent duplicate webhook (replay the same signed event twice quickly in the Bachs sandbox), wrong 2FA code ×6 → lock then recovery after ≤15 min, backup code single use, legacy no-DOB session shows the prompt, admin list shows expired accounts as expired.

## E. Real-PostgreSQL concurrency test (opt-in, not part of `npm test`)
`server/tests/integration/pg-concurrency.test.js` runs the real webhook and 2FA route code against a real, **disposable** PostgreSQL database (database name must start with `medai_it`):

```
createdb medai_it && for f in prisma/migrations/*/migration.sql; do psql -d medai_it -v ON_ERROR_STOP=1 -1 -f $f; done
npm i --no-save pg          # not a project dependency
TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/medai_it node --test tests/integration/pg-concurrency.test.js
```
It proves Postgres' real row locking / READ COMMITTED / rollback behaviour for the conditional claim, the expiry compare-and-set, backup-code single use, TOTP replay and the attempt cap. It does **not** exercise Prisma's own query generation (`tests/integration/pgAdapter.js` issues the equivalent SQL itself) and contacts no payment provider, email or OAuth service.

## F. Known remaining risks / decisions (not fixed in this branch)
- **Account enumeration at registration.** `POST /api/doctors/register` (and `/api/auth/register`) answer `409 "An account with this email already exists."` Changing that would break the sign-up UX (the user must be told to sign in instead). It is limited to 10 attempts/hour/IP for doctors and 20 per 15 min for patients; login responses are generic. Fixing it properly means an email-confirmation sign-up flow.
- **Logout is client-side.** Tokens are stateless JWTs with no server-side revocation list, so a token that was copied before logout stays valid until it expires (7 days by default). Rotating `JWT_SECRET` revokes everything (logs everyone out).
- **Root-level `achievements.js`** is an unused, stale copy of `server/src/routes/achievements.js` (no `<script>` or `require` references it). The repo has no `.vercelignore` and `vercel.json` has no build/output settings, so it is most likely served publicly as a static file at `/achievements.js` (inferred from configuration; not checked against the live site). It contains no secrets. Recommended follow-up: delete it, or add a `.vercelignore`.

## G. OUTSTANDING before merge / production (not done in this branch)
Status key: **OPEN** = not verified at all; **PARTIAL** = verified only against mocks or a local scratch database.

| # | Item | Status | What is still needed |
|---|------|--------|----------------------|
| 1 | **Prisma tooling** — `prisma validate`, `migrate diff`, `migrate status`, `migrate deploy`, `generate` | **OPEN** | They could not run in the dev sandbox (`Failed to fetch sha256 checksum at https://binaries.prisma.sh/... 403 Forbidden`). The migration was only validated at the SQL level on a scratch PostgreSQL 16 (see D.1). Run them against a staging database copy. |
| 2 | **Bachs sandbox / documentation** — signature scheme, retry schedule for non-2xx, response timeout, duplicate and out-of-order delivery, refund events | **OPEN** | The docs page could not be fetched and no sandbox payment was made. The 200-vs-500 response policy (D.4) and `collection.failed` handling are unconfirmed against Bachs' behaviour. Replay one signed sandbox event twice, quickly, and complete a sandbox payment end to end. |
| 3 | **Prisma's own query generation** for the conditional `updateMany`, `increment` and `equals` (array) used by the webhook and 2FA | **PARTIAL** | The real-PostgreSQL test (section E) issues equivalent SQL through its own adapter. Run the same scenarios through the real Prisma client on staging. |
| 4 | **Production verification** — live Google OAuth (2FA, no-2FA, no-DOB accounts), real 2FA devices/backup codes, Brevo email delivery, Render env vars (`FRONTEND_ORIGIN`, `JWT_SECRET`, `GOOGLE_*`, `BACHS_*`), client-IP detection behind Render's proxy, Vercel static serving, Safari/real devices | **OPEN** | See sections B, C and D. All automated tests use mocks. |
| 5 | Legacy-token cutoff decision (`ACCESS_TOKEN_LEGACY_CUTOFF`) and the existing Premium accounts with a null expiry | **OPEN** | Decide the cutoff; query null-expiry Premium users (read-only) and set expiries deliberately. |
| 6 | Root `achievements.js`, registration email enumeration, client-side-only logout | **OPEN** | See section F. |
