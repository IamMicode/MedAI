#!/usr/bin/env node
/**
 * Production configuration check. Run it WHERE the variables actually live
 * (Render → your service → Shell:  `node scripts/check-env.js`).
 *
 * It prints only SET / MISSING / OK / PROBLEM per variable. It never prints a
 * value — not even for non-secret ones — so its output is safe to paste.
 * Exit code is 1 if any REQUIRED variable is missing or malformed.
 */
const checks = [];
const add = (name, level, purpose, validate) => checks.push({ name, level, purpose, validate });


add('DATABASE_URL', 'required', 'runtime database connection', (v) => /^postgres(ql)?:\/\//.test(v) || 'not a postgres:// URL');
add('DIRECT_URL', 'required', 'direct connection used by `prisma migrate deploy` at boot', (v) => /^postgres(ql)?:\/\//.test(v) || 'not a postgres:// URL');
add('JWT_SECRET', 'required', 'signs every login token', (v) => v.length >= 32 || 'shorter than 32 characters — use a long random value');
add('FRONTEND_ORIGIN', 'required', 'CORS allowlist + OAuth/payment redirects', (v) => {
  const parts = v.split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return 'empty';
  for (const p of parts) {
    if (!/^https:\/\//.test(p) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(p)) return 'every entry must be https:// (or localhost for dev)';
    if (/\/$/.test(p)) return 'remove the trailing "/" — origins have none';
    if (/\s/.test(p) || /[/?#]/.test(p.replace(/^https?:\/\//, ''))) return 'must be a bare origin: scheme + host only, no path';
  }
  return true;
});
add('GEMINI_API_KEY', 'required', 'primary AI provider (chat, triage, report scan)');
add('OPENROUTER_API_KEY', 'recommended', 'AI fallback if Gemini fails');
add('BACHS_SECRET_KEY', 'required', 'creates Premium checkout sessions');
add('BACHS_WEBHOOK_SECRET', 'required', 'verifies payment webhooks (without it nobody is upgraded after paying)');
add('BREVO_API_KEY', 'required', 'sends password-reset emails');
add('BREVO_FROM_EMAIL', 'required', 'verified Brevo sender address', (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || 'not an email address');
add('GOOGLE_CLIENT_ID', 'optional', '"Sign in with Google" (all three GOOGLE_* or none)');
add('GOOGLE_CLIENT_SECRET', 'optional', '"Sign in with Google"');
add('GOOGLE_CALLBACK_URL', 'optional', 'must exactly match the redirect URI in Google Cloud Console', (v) => /^https:\/\/.+\/api\/auth\/google\/callback$/.test(v) || 'expected https://<backend>/api/auth/google/callback');
add('NODE_ENV', 'recommended', 'set to "production"', (v) => v === 'production' || 'is not "production"');

let problems = 0;
for (const c of checks) {
  const v = process.env[c.name];
  let status;
  if (v === undefined || v === '') {
    status = c.level === 'required' ? 'MISSING  (required)' : c.level === 'recommended' ? 'missing  (recommended)' : 'not set  (optional)';
    if (c.level === 'required') problems++;
  } else if (c.validate) {
    const r = c.validate(v);
    status = r === true ? 'SET, format OK' : `SET, PROBLEM: ${r}`;
    if (r !== true && c.level === 'required') problems++;
  } else status = 'SET';
  console.log(`${c.name.padEnd(22)} ${status.padEnd(34)} ${c.purpose}`);
}
const g = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'].map(k => !!process.env[k]);
if (g.some(Boolean) && !g.every(Boolean)) { console.log('\nPROBLEM: only some GOOGLE_* variables are set — Google sign-in needs all three.'); problems++; }
console.log(problems ? `\n${problems} problem(s) found.` : '\nAll required variables are present and well-formed.');
console.log('Note: this checks presence and format only. It cannot tell whether a key is valid with its provider.');
process.exit(problems ? 1 : 0);
