const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');

router.use(requireAuth);

// GET /api/2fa/status — is 2FA currently enabled for this account?
router.get('/status', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { twoFactorEnabled: true }
    });
    return res.json({ enabled: !!user?.twoFactorEnabled });
  } catch (error) {
    return next(error);
  }
});

// POST /api/2fa/setup — generate a new pending secret + QR code to scan.
// Not enabled yet until the user confirms a code back via /verify-setup.
router.post('/setup', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `MedAI (${user.email})`
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorPendingSecret: secret.base32 }
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      qrCodeDataUrl,
      manualEntryKey: secret.base32
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/2fa/verify-setup — confirm the code from the authenticator app, enable 2FA,
// and issue one-time backup codes (shown to the user exactly once).
router.post('/verify-setup', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'A 6-digit code is required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.twoFactorPendingSecret) {
      return res.status(400).json({ message: 'No pending 2FA setup found. Please start setup again.' });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorPendingSecret,
      encoding: 'base32',
      token: code.trim(),
      window: 1
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Incorrect code. Please try again.' });
    }

    // Generate 10 backup codes, store only their hashes, return plaintext once.
    const plainBackupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')
    );
    const hashedBackupCodes = await Promise.all(
      plainBackupCodes.map(c => bcrypt.hash(c, 10))
    );

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorBackupCodes: hashedBackupCodes
      }
    });

    return res.json({ message: '2FA enabled.', backupCodes: plainBackupCodes });
  } catch (error) {
    return next(error);
  }
});

// POST /api/2fa/disable — requires current password to turn 2FA off.
router.post('/disable', async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.password) {
      return res.status(400).json({ message: 'This account does not have a password set.' });
    }

    const passwordOk = await bcrypt.compare(password || '', user.password);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorBackupCodes: []
      }
    });

    return res.json({ message: '2FA disabled.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
