const { effectivePlan } = require('./premium');

function sanitizeUser(user) {
  if (!user) return null;
  const { password, googleId, twoFactorSecret, twoFactorPendingSecret, twoFactorBackupCodes, twoFactorLastStep, twoFactorAttempts, twoFactorWindowEndsAt, ...safeUser } = user;
  // Expose the *effective* plan so a lapsed subscription never shows as Premium.
  if ('plan' in safeUser) safeUser.plan = effectivePlan(user);
  return safeUser;
}

module.exports = sanitizeUser;
