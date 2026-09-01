const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { Resend } = require('resend');
const { passport } = require('../passport');
const prisma = require('../db');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimits');
const { createToken } = require('../utils/jwt');
const sanitizeUser = require('../utils/sanitizeUser');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema
} = require('../validation/authSchemas');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: req.body.email },
          { username: req.body.username }
        ]
      }
    });

    if (existing) {
      return res.status(409).json({ message: 'An account with that email or username already exists.' });
    }

    const password = await bcrypt.hash(req.body.password, 12);
    const user = await prisma.user.create({
      data: {
        ...req.body,
        password,
        authProvider: 'credentials'
      }
    });

    return res.status(201).json({
      token: createToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const usernameOrEmail = req.body.usernameOrEmail.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: usernameOrEmail },
          { username: { equals: req.body.usernameOrEmail, mode: 'insensitive' } }
        ]
      }
    });

    if (!user?.password) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    const passwordOk = await bcrypt.compare(req.body.password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    if (user.twoFactorEnabled) {
      // Password is correct, but don't issue a real session token yet — require
      // the 6-digit authenticator code (or a backup code) first. This pre-auth
      // token is short-lived and only proves "password already verified", it
      // carries no role/plan trust and can't be used to call any real API route.
      const pendingToken = jwt.sign(
        { id: user.id, pending2FA: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requires2FA: true, pendingToken });
    }

    return res.json({
      token: createToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/2fa/verify-login — second step of login when 2FA is enabled.
router.post('/2fa/verify-login', authLimiter, async (req, res, next) => {
  try {
    const { pendingToken, code } = req.body;
    if (!pendingToken || !code) {
      return res.status(400).json({ message: 'pendingToken and code are required.' });
    }

    let payload;
    try {
      payload = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: 'Your login session expired. Please log in again.' });
    }
    if (!payload.pending2FA) {
      return res.status(401).json({ message: 'Invalid login session.' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user?.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled on this account.' });
    }

    const trimmedCode = String(code).trim();
    const isTotpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: trimmedCode,
      window: 1
    });

    if (isTotpValid) {
      return res.json({ token: createToken(user), user: sanitizeUser(user) });
    }

    // Not a valid TOTP code — check if it matches (and consumes) a backup code instead.
    for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
      const matches = await bcrypt.compare(trimmedCode, user.twoFactorBackupCodes[i]);
      if (matches) {
        const remaining = [...user.twoFactorBackupCodes];
        remaining.splice(i, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorBackupCodes: remaining }
        });
        return res.json({ token: createToken(user), user: sanitizeUser(user) });
      }
    }

    return res.status(401).json({ message: 'Incorrect code. Please try again.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/google', authLimiter, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Google sign-in is not configured yet.' });
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })(req, res, next);
});

router.get('/google/callback', authLimiter, (req, res, next) => {
  passport.authenticate('google', { session: false }, (error, user, info) => {
    if (error) return next(error);
    if (!user) {
      const message = encodeURIComponent(info?.message || 'Google sign-in failed.');
      return res.redirect(`${process.env.FRONTEND_ORIGIN || ''}/Login_page.html?oauth_error=${message}`);
    }

    const token = createToken(user);
    const destination = user.role === 'ADMIN' ? '/admin.html' : '/dashboard.html';
    const redirectUrl = new URL(destination, process.env.FRONTEND_ORIGIN || 'http://localhost:3000');
    redirectUrl.searchParams.set('token', token);
    return res.redirect(redirectUrl.toString());
  })(req, res, next);
});

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 12);

    await prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.PASSWORD_RESET_FROM || 'MedAI <onboarding@resend.dev>',
        to: user.email,
        subject: 'Your MedAI password reset code',
        text: `Your MedAI password reset code is ${code}. It expires in 10 minutes.`
      });
    } else {
      console.warn(`Password reset code for ${user.email}: ${code}`);
    }

    return res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/verify-reset-code', authLimiter, validate(verifyResetCodeSchema), async (req, res, next) => {
  try {
    const valid = await findValidResetCode(req.body.email, req.body.code);
    return res.json({ valid: Boolean(valid) });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const resetCode = await findValidResetCode(req.body.email, req.body.code);
    if (!resetCode) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    const password = await bcrypt.hash(req.body.password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetCode.userId },
        data: { password, authProvider: 'credentials' }
      }),
      prisma.passwordResetCode.update({
        where: { id: resetCode.id },
        data: { usedAt: new Date() }
      })
    ]);

    return res.json({ message: 'Password reset successful.' });
  } catch (error) {
    return next(error);
  }
});

async function findValidResetCode(email, code) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const resetCodes = await prisma.passwordResetCode.findMany({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  for (const resetCode of resetCodes) {
    if (await bcrypt.compare(code, resetCode.codeHash)) {
      return resetCode;
    }
  }

  return null;
}

module.exports = router;
