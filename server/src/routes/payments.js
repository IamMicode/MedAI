const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');

// Server-side price authority — never trust a client-submitted amount.
// Mirrors dashboard.js's `prices` table; keep these two in sync if pricing changes.
const PRICE_TABLE = {
  NG: { symbol: '₦',   currency: 'NGN', monthly: 3500,  yearly: 29400 },
  US: { symbol: '$',   currency: 'USD', monthly: 4.99,  yearly: 41.90 },
  GB: { symbol: '£',   currency: 'GBP', monthly: 3.99,  yearly: 33.50 },
  EU: { symbol: '€',   currency: 'EUR', monthly: 4.49,  yearly: 37.70 },
  GH: { symbol: '₵',   currency: 'GHS', monthly: 65,    yearly: 546   },
  KE: { symbol: 'KSh', currency: 'KES', monthly: 649,   yearly: 5452  },
  ZA: { symbol: 'R',   currency: 'ZAR', monthly: 89,    yearly: 748   },
  CA: { symbol: 'CA$', currency: 'CAD', monthly: 6.99,  yearly: 58.70 },
  AU: { symbol: 'A$',  currency: 'AUD', monthly: 7.49,  yearly: 62.90 },
  IN: { symbol: '₹',   currency: 'INR', monthly: 399,   yearly: 3350  }
};

// POST /api/payments/initialize — patient starts a Premium checkout
router.post('/initialize', requireAuth, async (req, res, next) => {
  try {
    const { country, planType } = req.body;
    if (!['monthly', 'yearly'].includes(planType)) {
      return res.status(400).json({ message: 'planType must be "monthly" or "yearly".' });
    }
    const pricing = PRICE_TABLE[country] || PRICE_TABLE.NG;
    const amount = planType === 'yearly' ? pricing.yearly : pricing.monthly;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const txRef = `medai_${req.user.id}_${Date.now()}`;

    await prisma.payment.create({
      data: {
        userId: req.user.id,
        txRef,
        amount,
        currency: pricing.currency,
        planType,
        status: 'PENDING'
      }
    });

    return res.json({
      txRef,
      amount,
      currency: pricing.currency,
      email: user.email,
      name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || ''
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/payments/status/:txRef — patient frontend polls this after checkout closes
router.get('/status/:txRef', requireAuth, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { txRef: req.params.txRef } });
    if (!payment || payment.userId !== req.user.id) {
      return res.status(404).json({ message: 'Payment not found.' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { plan: true, premiumExpiresAt: true } });
    return res.json({ status: payment.status, plan: user.plan, premiumExpiresAt: user.premiumExpiresAt });
  } catch (error) {
    return next(error);
  }
});

// POST /api/payments/webhook — Flutterwave calls this automatically on payment events.
// Never trust the webhook body alone — always re-verify the transaction with Flutterwave's API
// using the secret key before granting anything, so a spoofed webhook can't fake a payment.
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['verif-hash'];
    const expectedHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!expectedHash || !signature || signature !== expectedHash) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    // Acknowledge immediately per Flutterwave's guidance; do the real work after.
    res.status(200).json({ received: true });

    const event = req.body;
    if (event?.data?.status !== 'successful') return;

    const flwTransactionId = event.data.id;
    const txRef = event.data.tx_ref;

    const payment = await prisma.payment.findUnique({ where: { txRef } });
    if (!payment || payment.status === 'SUCCESSFUL') return; // unknown or already processed

    // Re-verify directly with Flutterwave's API — the authoritative source of truth.
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwTransactionId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
    });
    const verifyData = await verifyRes.json();
    const tx = verifyData?.data;

    const isValid = tx
      && tx.status === 'successful'
      && tx.tx_ref === payment.txRef
      && tx.currency === payment.currency
      && tx.amount >= payment.amount;

    if (!isValid) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', flwTransactionId: String(flwTransactionId) } });
      return;
    }

    const now = new Date();
    const durationMs = payment.planType === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESSFUL', flwTransactionId: String(flwTransactionId), verifiedAt: now }
      }),
      prisma.user.update({
        where: { id: payment.userId },
        data: {
          plan: 'Premium',
          premiumActivatedAt: now,
          premiumExpiresAt: new Date(now.getTime() + durationMs)
        }
      })
    ]);
  } catch (error) {
    // Already responded 200 to Flutterwave above; just log for our own visibility.
    console.error('Flutterwave webhook processing error:', error);
  }
});

module.exports = router;
