function sanitizeUser(user) {
  if (!user) return null;
  const { password, googleId, ...safeUser } = user;
  return safeUser;
}

module.exports = sanitizeUser;
