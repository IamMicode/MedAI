function sanitizeUser(user) {
  if (!user) return null;
  const { password, googleId, twoFactorSecret, twoFactorPendingSecret, twoFactorBackupCodes, ...safeUser } = user;
  return safeUser;
}

module.exports = sanitizeUser;
