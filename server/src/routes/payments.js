const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');
const notify = require('../utils/notify');

// Bachs (https://bachs.io) — hosted checkout + webhook, similar shape to Stripe/Flutterwave
// but the customer is fully redirected to a hosted page rather than an inline widget.
const BACHS_SECRET_KEY = process.env.BACHS_SECRET_KEY || '';
const BACHS_BASE_URL = BACHS_SECRET_KEY.startsWith('sk_sandbox_')
  ? 'https://sandbox-api.bachs.io'
  : 'https://api.bachs.io';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// Server-side price authority — never trust a client-submitted amount.
// Mirrors dashboard.js's `prices` table; keep these two in sync if pricing changes.
const PRICE_TABLE = {
  NG: { currency: 'NGN', monthly: 3500,  yearly: 29400 },
  US: { currency: 'USD', monthly: 4.99,  yearly: 41.90 },
  GB: { currency: 'GBP', monthly: 3.99,  yearly: 33.50 },
  EU: { currency: 'EUR', monthly: 4.49,  yearly: 37.70 },
  GH: { currency: 'GHS', monthly: 65,    yearly: 546   },
  KE: { currency: 'KES', monthly: 649,   yearly: 5452  },
  ZA: { currency: 'ZAR', monthly: 89,    yearly: 748   },
  CA: { currency: 'CAD', monthly: 6.99,  yearly: 58.70 },
  AU: { currency: 'AUD', monthly: 7.49,  yearly: 62.90 },
  IN: { currency: 'INR', monthly: 399,   yearly: 3350  }
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
        provider: 'bachs',
        txRef,
        amount,
        currency: pricing.currency,
        planType,
        status: 'PENDING'
      }
    });

    const successUrl = `${FRONTEND_ORIGIN}/dashboard.html?payment=success&txRef=${txRef}`;
    const cancelUrl = `${FRONTEND_ORIGIN}/dashboard.html?payment=cancelled`;

    const bachsRes = await fetch(`${BACHS_BASE_URL}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BACHS_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pricing: { currency: pricing.currency, amount: String(amount) },
        customer: {
          email: user.email,
          name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        reference: txRef,
        metadata: { txRef, userId: req.user.id }
      })
    });

    if (!bachsRes.ok) {
      const errBody = await bachsRes.json().catch(() => ({}));
      await prisma.payment.update({ where: { txRef }, data: { status: 'FAILED' } });
      console.error('Bachs checkout-session creation failed:', bachsRes.status, errBody);
      return res.status(502).json({ message: errBody.detail || errBody.message || 'Could not start checkout with payment provider.' });
    }

    const bachsData = await bachsRes.json();

    if (process.env.NODE_ENV !== 'production') {
      // Dev-only visibility into Bachs' response shape. Never log secret keys or card data.
      console.log('[Bachs] checkout-session response:', {
        checkout_id: bachsData.checkout_id,
        charge_status: bachsData.charge_status,
        attempt_status: bachsData.attempt_status,
        checkout_status: bachsData.checkout_status,
        failure_message: bachsData.failure_message,
        amount_paid: bachsData.amount_paid,
        amount_remaining: bachsData.amount_remaining,
        redirect_url: bachsData.redirect_url
      });
    }

    await prisma.payment.update({
      where: { txRef },
      data: { checkoutId: bachsData.checkout_id || null }
    });

    // Bachs' checkout-session response reports state via charge_status/checkout_status,
    // NOT via HTTP status — a 200 here does not mean the payment succeeded, and a
    // missing redirect_url does not mean it failed. Only charge_status === 'failed'
    // is a real failure; 'processing' + checkout_status 'open' is a normal pending
    // state (the session exists but hasn't been redirected to / completed yet).
    if (bachsData.charge_status === 'failed') {
      await prisma.payment.update({ where: { txRef }, data: { status: 'FAILED' } });
      return res.status(200).json({
        status: 'FAILED',
        message: bachsData.failure_message || 'Payment failed.',
        txRef
      });
    }

    if (bachsData.charge_status === 'succeeded') {
      // Rare at initialize time, but handle it rather than assume it can't happen —
      // the webhook remains the authoritative source of truth for actually granting Premium.
      return res.json({
        status: 'SUCCESSFUL',
        redirectUrl: bachsData.redirect_url || null,
        txRef
      });
    }

    // charge_status is 'processing' (or similar in-flight state) and checkout_status is
    // 'open' — this is pending, not a failure, whether or not redirect_url is populated yet.
    return res.json({
      status: 'PENDING',
      redirectUrl: bachsData.redirect_url || null,
      txRef
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/payments/status/:txRef — patient frontend polls this after returning from checkout
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

// POST /api/payments/webhook — Bachs calls this automatically on payment events.
// Verified via HMAC-SHA256 over the raw request body (see index.js for how rawBody is captured).
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-bachs-signature'];
    const secret = process.env.BACHS_WEBHOOK_SECRET;

    if (!secret || !signature || !req.rawBody) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    const isValidSignature = signatureBuf.length === expectedBuf.length
      && crypto.timingSafeEqual(signatureBuf, expectedBuf);

    if (!isValidSignature) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    // Acknowledge immediately; do the real work after.
    res.status(200).json({ received: true });

    const event = req.body;
    if (event?.type !== 'collection.succeeded') return;

    const data = event.data || {};
    // Bachs is a very new provider — try every plausible location for our own reference
    // before falling back to the checkout_id we stored ourselves at initialize time.
    const txRef = event.metadata?.txRef || data.metadata?.txRef || data.reference || null;

    let payment = txRef
      ? await prisma.payment.findUnique({ where: { txRef } })
      : null;

    if (!payment && data.checkout_id) {
      payment = await prisma.payment.findFirst({ where: { checkoutId: data.checkout_id } });
    }

    if (!payment) {
      console.error('Bachs webhook: could not match any payment for event', event.id);
      return;
    }
    if (payment.status === 'SUCCESSFUL') return; // already processed

    const isValid = data.status === 'succeeded'
      && data.currency === payment.currency
      && parseFloat(data.amount) >= payment.amount;

    if (!isValid) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', providerRef: data.charge_id || null } });
      return;
    }

    const now = new Date();
    const durationMs = payment.planType === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESSFUL', providerRef: data.charge_id || null, verifiedAt: now }
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

    await notify(payment.userId, {
      type: 'payment_success',
      title: 'Premium activated! 🎉',
      body: `Your ${payment.planType} Premium subscription is now active. Enjoy unlimited AI access.`,
      link: 'premium'
    });
  } catch (error) {
    // Already responded 200 to Bachs above; just log for our own visibility.
    console.error('Bachs webhook processing error:', error);
  }
});

module.exports = router;
