const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');
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

const RESET_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes — used by both the DB expiry and the email copy below
const RESET_CODE_MAX_ATTEMPTS = 5;

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    }

    // A fresh request supersedes any earlier one — only the newest code for
    // this user should be usable, so a stale code from an earlier request
    // (e.g. one the user abandoned, or one an attacker triggered) can't be
    // used after a newer one has been issued.
    await prisma.passwordResetCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    // crypto.randomInt is cryptographically secure and free of the modulo
    // bias a naive `% 900000` would introduce — Math.random() is not
    // appropriate for anything security-sensitive like this.
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 12);

    await prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS)
      }
    });

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      // Gmail SMTP requires the "from" address to be the authenticated
      // account itself (or a verified alias) — unlike Resend's model, it
      // won't send as an arbitrary domain, so this is just the account with
      // a friendly display name.
      const fromAddress = `MedAI <${process.env.GMAIL_USER}>`;
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });
        const info = await transporter.sendMail({
          from: fromAddress,
          to: user.email,
          subject: 'Your MedAI password reset code',
          text: `Your MedAI password reset code is ${code}. It expires in ${RESET_CODE_TTL_MS / 60000} minutes. If you did not request this, you can safely ignore this email.`
        });
        console.log(`Password reset email sent for user ${user.id}. Gmail message id=${info.messageId}`);
      } catch (emailError) {
        // Unlike Resend, nodemailer REJECTS the promise on a send failure
        // rather than resolving with an error field — caught here
        // specifically so a Gmail-side failure (bad app password, account
        // locked, etc.) is logged clearly without turning into a 500 that
        // would leak a different response than the "email doesn't exist"
        // case and break account-enumeration protection.
        console.error(`Gmail SMTP failed to send password reset email for user ${user.id}: ${emailError.message}`);
      }
    } else {
      console.warn(`GMAIL_USER/GMAIL_APP_PASSWORD not set — password reset code for user ${user.id} was not emailed.`);
    }

    console.log(`Password reset requested for user ${user.id}.`);
    // The response to the CLIENT stays generic either way — this is required
    // for account-enumeration protection (Requirement 6/15) and must not
    // change based on whether the email actually sent. The distinction
    // between "sent" and "Gmail rejected it" lives only in the server logs
    // above, where a developer debugging non-delivery can actually see it.
    return res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/verify-reset-code', authLimiter, validate(verifyResetCodeSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) {
      // Same generic shape as an incorrect code — don't let this endpoint
      // become a second way to enumerate accounts.
      return res.status(400).json({ message: 'That verification code is incorrect or has expired.' });
    }

    const resetCode = await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });

    if (!resetCode) {
      return res.status(400).json({ message: 'That verification code has expired. Please request a new code.' });
    }

    if (resetCode.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      await prisma.passwordResetCode.update({ where: { id: resetCode.id }, data: { usedAt: new Date() } });
      return res.status(429).json({ message: 'Too many verification attempts. Please request a new code.' });
    }

    const matches = await bcrypt.compare(req.body.code, resetCode.codeHash);
    if (!matches) {
      const attempts = resetCode.attempts + 1;
      const lockedOut = attempts >= RESET_CODE_MAX_ATTEMPTS;
      await prisma.passwordResetCode.update({
        where: { id: resetCode.id },
        data: { attempts, ...(lockedOut ? { usedAt: new Date() } : {}) }
      });
      console.log(`Failed reset-code verification for user ${user.id} (attempt ${attempts}).`);
      return res.status(lockedOut ? 429 : 400).json({
        message: lockedOut
          ? 'Too many verification attempts. Please request a new code.'
          : 'That verification code is incorrect. Please check the code and try again.'
      });
    }

    // Correct code — issue a separate, opaque, single-use credential for the
    // actual password change rather than letting the 6-digit code itself
    // authorize it directly. Only its hash is stored; the raw value is
    // returned to the client once, the same way a one-time link token would be.
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { verifiedAt: resetCode.verifiedAt || new Date(), resetTokenHash, attempts: 0 }
    });

    console.log(`Reset code verified for user ${user.id}.`);
    return res.json({ valid: true, resetToken });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset session. Please verify your code again.' });
    }

    const resetTokenHash = crypto.createHash('sha256').update(req.body.resetToken).digest('hex');
    const resetCode = await prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        verifiedAt: { not: null },
        expiresAt: { gt: new Date() },
        resetTokenHash
      }
    });

    if (!resetCode) {
      return res.status(400).json({ message: 'Invalid or expired reset session. Please verify your code again.' });
    }

    const hadPasswordBefore = Boolean(user.password);
    const password = await bcrypt.hash(req.body.password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password, authProvider: 'credentials' }
      }),
      prisma.passwordResetCode.update({
        where: { id: resetCode.id },
        data: { usedAt: new Date(), resetTokenHash: null }
      })
    ]);

    console.log(`Password reset completed for user ${user.id}.`);
    return res.json({
      message: hadPasswordBefore
        ? 'Password reset successful.'
        : 'Password set successfully. You can now sign in with your email and password, in addition to Google.'
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
