# MedAI - Backend Integration Project Brief for Codex

## Context

I have a fully built **frontend-only** health app called MedAI. It currently uses
**localStorage** for everything (no real backend, no database, no server). I need
you to add a real backend, one phase at a time, explaining each step in plain
language since I have no backend experience.

**Important ground rules:**
- Do NOT touch any visual design, CSS, animations, or layout. Only wire up data/logic.
- Explain what you're doing in plain English before and after each change - assume
  I don't know backend terminology.
- Work in small phases (listed below). After each phase, stop and tell me what
  changed and what I should test, before moving to the next phase.
- If something is ambiguous or you're unsure which approach I'd prefer, ASK ME -
  don't silently decide for me.
- Keep the stack as simple as possible given I'm a beginner.

---

## Current Project Files (all frontend-only, using localStorage)

- `Login_page.html` - login form, validates against `localStorage.medai_users`
- `register.html` - 3-step registration (account -> personal profile -> health
  profile), saves to `localStorage.medai_users` and `localStorage.medai_current_user`
- `Forget_Password.html` - password reset flow. **Currently fake**: generates a
  6-digit OTP and displays it directly on screen instead of emailing it (demo mode)
- `dashboard.html` + `dashboard.js` - main app: sidebar nav, AI chat tabs
  (Chatbot, Emotional AI, Mental Health AI, Physical Health AI), triage history,
  health profile tab, achievements, settings, premium plans page, vitals,
  notifications
- `admin.html` / `admin1.html` - admin panel that reads `medai_users` and all
  localStorage keys directly in the browser to show user lists, triage logs,
  analytics. Access is gated only by a `sessionStorage` flag set after typing a
  secret username on the login page (no real server-side check)
- `Med_AI_2.html` / `MedAI_2.html` / `Med_AI.html` - the AI symptom triage tool
  (calls Gemini API directly from the browser)
- `MED_AI_LAND.html` - public landing page with an email waitlist form (doesn't
  actually save anywhere right now)
- `medai-transition.js` - page transition loader (no backend needed, leave as is)

## Current localStorage Keys (you'll be replacing these with real API calls)

- `medai_users` - array of all registered users (plaintext passwords currently!)
- `medai_current_user` - the logged-in user's full object
- `medai_triage_<username>` - array of that user's triage history
- `medai_achievements_<username>` - array of unlocked achievement IDs
- `medai_admin_session` - flag for admin access (insecure, browser-only)

## API Keys Currently Exposed in Frontend Code (CRITICAL - must fix)

- A **Gemini API key** is hardcoded in `dashboard.js` / `Med_AI_2.html`
- An **OpenRouter API key** is hardcoded in `dashboard.js`
- Both are visible to anyone who opens browser DevTools. These must move to
  the backend, called server-side only, never sent to the frontend.
- I will revoke and regenerate both keys once the backend is ready to hold them
  as environment variables - flag this to me as a reminder near the end.

---

## Required Stack (this is decided - do not substitute without asking)

- **Node.js + Express** - backend server (matches the JS I already know from frontend)
- **A real persistent database is required** - I do NOT want localStorage,
  in-memory storage, flat files, or anything that disappears on restart. Use
  **PostgreSQL** with **Prisma ORM** (Prisma's schema file is easy for a
  beginner like me to read and modify, and its migration commands keep the
  database structure in sync automatically)
- For getting a real database running with the least setup pain, use
  **Supabase PostgreSQL** as the strong recommendation for a beginner:
  excellent free tier, friendly dashboard, Prisma support, and no need to run
  Postgres locally. Mention **Neon** as the main alternative if serverless
  scaling-to-zero matters more.
- **JWT** (JSON Web Tokens) for login sessions + **bcrypt** for password hashing
- **Resend** for sending real password-reset emails. If Resend is blocked or I
  strongly prefer Gmail, ask before switching to Nodemailer + Gmail SMTP.
- Add basic production/security middleware early:
  - `cors` configured to allow my frontend origin
  - `helmet` for security headers
  - `express-rate-limit` on auth routes, especially login/register/password reset
  - input validation using **Zod** or **express-validator**, especially for
    register, login, password reset, profile updates, and triage requests

Every piece of data currently in localStorage (users, profiles, triage
history, achievements, waitlist emails) must end up as a **table in this
database**, not in any temporary or local-only storage.

---

## OAuth / Social Login (New Requirement)

Add **Sign in with Google** (primary) to the login page, with clean buttons
showing the Google logo. This must **actually work** for real users - not just
fake/demo.

**Implementation details for Codex:**
- Use **Passport.js** with `passport-google-oauth20` strategy, or use
  `google-auth-library` with a manual flow. Explain the pros/cons briefly before
  choosing. For a beginner project, Passport.js is probably the easiest.
- Add these fields to the `User` model in Prisma schema:
  ```prisma
  googleId      String?   @unique
  authProvider  String?   // "google", "credentials", etc.
  avatarUrl     String?
  emailVerified Boolean   @default(false)
  ```
- Make the `password` field optional (`String?`) because Google users may not
  have a password.
- Endpoints:
  - `GET /api/auth/google` - starts OAuth flow (redirect to Google)
  - `GET /api/auth/google/callback` - handles callback, creates/finds user,
    links accounts when appropriate, and issues JWT
- Frontend changes (only logic, no design rewrite):
  - Add a Google sign-in button with logo in `Login_page.html` near the existing form
  - Use an `<img>` or inline SVG for the Google logo
  - On click: redirect to `/api/auth/google`
  - On success: store JWT in localStorage and redirect to dashboard, same as normal login
- Handle account linking:
  - If a user already exists with the same email from password login, link the
    Google account by saving `googleId`, `authProvider`, `avatarUrl`, and
    `emailVerified`
  - Do not create duplicate users for the same email
- Store Google profile picture in `avatarUrl`.

**Credentials I will create:**
- Google Cloud Console -> APIs & Services -> Credentials -> OAuth Client ID
- Application type: Web application
- Authorized JavaScript origins: my frontend origin, for example
  `http://localhost:3000` or wherever the frontend is served from
- Authorized redirect URIs:
  - Local: `http://localhost:5000/api/auth/google/callback`
  - Production: the deployed backend callback URL
- Add these to `.env`:
  ```env
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
  ```

Do this in **Phase 1** (Authentication), alongside email/password login.

**Decision point:** Ask me whether to add GitHub sign-in too, or keep only Google
for now.

---

## Phase-by-Phase Plan

### Phase 0 - Project Setup
- Initialize a Node/Express backend in a new `/server` folder alongside the
  existing frontend files
- Set up a **hosted PostgreSQL database** using **Supabase** unless I choose
  Neon instead. Explain how I sign up for Supabase's free tier and how to get
  the connection string
- Set up Prisma and create the initial schema with tables for: `User`,
  `TriageRecord`, `Achievement`, `WaitlistEmail`, and `PasswordResetCode` -
  show me the schema file so I understand what's being stored
- The `User` schema must include fields for:
  - account identity: `id`, `firstname`, `lastname`, `username`, `email`
  - auth: nullable `password`, `googleId`, `authProvider`, `emailVerified`,
    `avatarUrl`
  - permissions/subscription: `role` with enum/default `USER`, and `plan` with
    default `"Free"`
  - profile fields currently collected in registration: `dob`, `gender`,
    `height`, `weight`, `bloodGroup`, `country`, `phone`, `conditions`,
    `otherConditions`, `allergies`, `medications`, `smokes`, `alcohol`,
    `exercises`, `emergName`, `emergPhone`
- Use a proper role enum if practical:
  ```prisma
  enum Role {
    USER
    ADMIN
  }
  ```
- Run the first migration so these tables actually exist in the database -
  confirm to me that you can see them (e.g. via `npx prisma studio`)
- Add a `.env` file for secrets (explain what `.env` is and why it's gitignored)
- Add a basic health-check endpoint (`GET /api/health`) so I can confirm the
  server runs and is connected to the database
- Add CORS, Helmet, basic auth route rate limiting, and the chosen validation
  library foundation during setup so later routes are safer by default

### Phase 1 - Authentication
- `POST /api/auth/register` - create account, hash password with bcrypt, store
  in DB (map all fields currently collected in `register.html`'s 3 steps:
  firstname, lastname, username, email, password, dob, gender, height, weight,
  bloodGroup, country, phone, conditions[], otherConditions, allergies[],
  medications, smokes, alcohol, exercises, emergName, emergPhone)
- Ensure the Prisma `password` field is nullable (`String?`) to support OAuth users
- `POST /api/auth/login` - verify credentials, return a JWT
- Include `id`, `email`, `username`, `role`, and `plan` in the JWT payload
- Add Google OAuth:
  - `GET /api/auth/google`
  - `GET /api/auth/google/callback`
  - create/find/link user by email
  - save `googleId`, `authProvider`, `avatarUrl`, and `emailVerified`
  - issue the same JWT shape used by password login
- Ask me whether to also add GitHub login now, or keep Google only
- Middleware to protect routes that require login
- Update `Login_page.html` and `register.html` to call these endpoints via
  `fetch()` instead of touching localStorage directly
- Keep using localStorage ONLY to store the JWT token client-side (that part's fine)
- Add validation to register/login/OAuth callback handling, and rate-limit auth routes

### Phase 2 - User Profile & Health Data
- `GET /api/profile` - fetch the logged-in user's full profile
- `PUT /api/profile` - update profile (used by the "My Profile" tab edits)
- `DELETE /api/profile` - delete account (with confirmation already built into
  the frontend modal)
- `PUT /api/profile/password` - change password (verify current password first)
- Wire these into `dashboard.html`'s profile tab and settings tab
- Validate profile update input before writing to the database

### Phase 3 - Triage History
- `POST /api/triage` - save a new triage result (symptoms, triage_level,
  triage_title, summary, confidence, date) tied to the logged-in user
- `GET /api/triage` - fetch the user's triage history
- `DELETE /api/triage` - clear history
- Replace the `medai_triage_<username>` localStorage logic in `dashboard.js`
  with these calls
- Validate triage payloads before saving

### Phase 4 - Move AI Calls Server-Side (CRITICAL - fixes exposed keys)
- `POST /api/ai/triage` - backend calls Gemini using the server-stored key,
  returns the triage result. Frontend `Med_AI_2.html` / dashboard Quick Triage
  call this instead of calling Gemini directly
- `POST /api/ai/chat` - accepts
  `{ aiType: 'chatbot'|'emotional'|'mental'|'physical', message, history }`
  and routes to the correct provider server-side (Gemini for chatbot/emotional,
  OpenRouter for mental, and ask me what to do about physical - see note below)
- Remove all API keys from every frontend file once this works
- Validate AI request bodies and rate-limit AI routes enough to prevent obvious abuse

**Flag to me:** Physical Health AI currently calls Ollama running on
`localhost:11434` on the user's own machine. This only works for me locally -
real users won't have Ollama installed. Ask me whether to: (a) switch Physical
AI to Gemini/OpenRouter like the others, or (b) keep Ollama as a "power user"
option with a fallback. Don't decide this yourself.

### Phase 5 - Achievements
- `GET /api/achievements` - fetch unlocked achievement IDs for the user
- `POST /api/achievements/check` - server checks triage history/profile
  completeness and returns any newly unlocked achievements
- Replace `medai_achievements_<username>` logic accordingly

### Phase 6 - Real Password Reset (fixes the fake on-screen OTP)
- `POST /api/auth/forgot-password` - generate a 6-digit code, store it
  server-side with a 10-minute expiry, email it via Resend. Never send the code
  back in the API response.
- `POST /api/auth/verify-reset-code` - verify the submitted code
- `POST /api/auth/reset-password` - set the new password
- Update `Forget_Password.html` to remove the on-screen demo code display
  entirely once this works
- Rate-limit all password reset endpoints

### Phase 7 - Admin Panel (proper security)
- Use the `role` field on `User` and include it in the JWT payload
- Admin-only routes must check `req.user.role === 'ADMIN'` server-side
- Do NOT rely on a browser-set `sessionStorage` flag for real access
- `GET /api/admin/users` - list all users (no passwords in the response)
- `GET /api/admin/users/:id` - single user detail
- `DELETE /api/admin/users/:id` - admin deletes a user
- `GET /api/admin/triage` - all triage logs across users, for the analytics tabs
- `GET /api/admin/analytics` - aggregate stats (conditions breakdown, triage
  level breakdown, gender distribution, etc. - match what `admin.html`
  currently computes client-side)
- Keep the "secret username on login page redirects to admin" UX if I want it,
  but the actual access check must happen server-side via the JWT role, not a
  client-settable flag

### Phase 8 - Waitlist (landing page)
- `POST /api/waitlist` - save an email to the database from `MED_AI_LAND.html`
- `GET /api/admin/waitlist` - let me view collected emails from the admin panel
- Validate email input and prevent duplicate waitlist rows for the same email

### Phase 9 - Free Plan Limits (mentioned in pricing but never enforced)
- Use the `plan` field on `User`, defaulting to `"Free"`
- Track triage session count per day per user server-side
- If `plan === 'Free'` and daily count exceeds the limit (e.g. 5/day), return
  an error the frontend can show, prompting upgrade
- Leave actual payment processing (Stripe/Paystack) as a future phase - just
  ask me before starting on it, don't build it yet

---

## What NOT to Change

- No visual/CSS changes anywhere
- No changes to the ReactBits effects, particle canvases, page transitions
- Don't restructure the HTML layout - only add `fetch()` calls where
  localStorage logic currently lives
- For Google sign-in, add only the minimal button markup needed near the login
  form and keep existing styling untouched

## Security / Production Requirements

- Do not return passwords, reset codes, or API keys in any API response
- Hash passwords with bcrypt
- Store secrets only in `.env`
- Configure CORS to allow my frontend origin
- Use Helmet
- Rate-limit authentication, password reset, and AI routes
- Validate important request bodies using Zod or express-validator
- Use server-side authorization for admin and protected user routes
- Keep JWT expiration reasonable and explain where it is configured

## Deployment Notes

- Near the end, remind me that the backend lives in `/server` and that this is
  the folder I should deploy to Railway, Render, or another Node backend host
- Explain which environment variables must be set in production:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `FRONTEND_ORIGIN`
  - `RESEND_API_KEY`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL`
  - `GEMINI_API_KEY`
  - `OPENROUTER_API_KEY`
- Remind me to revoke and regenerate the Gemini/OpenRouter keys currently
  exposed in frontend code after server-side AI calls are working
- Remind me to add the deployed backend callback URL in Google Cloud Console
  for OAuth

## How I Want You to Communicate

- Before each phase, give me a 2-3 sentence plan in plain English
- After each phase, tell me exactly what to test and how (e.g. "open the
  register page, fill it out, and check the database has a new row")
- If you hit a decision point not covered above, ask me - don't assume
- Flag clearly when I need to do something outside the code (e.g. "go revoke
  your Gemini key now," "create a free Resend account and get an API key")
