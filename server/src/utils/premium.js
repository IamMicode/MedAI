// Single source of truth for "does this user currently have Premium?".
//
// Subscription rule (see payments.js webhook): every successful Bachs payment
// sets plan='Premium' AND premiumExpiresAt (+30d monthly / +365d yearly).
// So Premium is only valid while premiumExpiresAt is in the future. A missing
// or unparseable expiry is NOT treated as "forever": no paid period is on
// record, so no Premium benefits. Nothing is written back to the DB here — the
// stored plan and Payment rows are left untouched, so a later renewal simply
// sets a fresh expiry and Premium returns.
function isPremiumActive(user, now = new Date()) {
  if (!user) return false;
  if (String(user.plan || '').toLowerCase() !== 'premium') return false;
  if (!user.premiumExpiresAt) return false;
  const exp = new Date(user.premiumExpiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > now.getTime();
}

const effectivePlan = (user, now) => (isPremiumActive(user, now) ? 'Premium' : 'Free');

module.exports = { isPremiumActive, effectivePlan };
