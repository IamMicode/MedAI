const jwt = require('jsonwebtoken');

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      plan: user.plan,
      typ: 'access',
      // Only set when the date of birth is known to be on file; requireAuth skips
      // its database check for these. Absent → requireAuth verifies against the DB.
      ...(user.dob ? { dobOk: true } : {})
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { createToken };
