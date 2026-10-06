const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');
const notify = require('../utils/notify');
const { getFrontendOrigin } = require('../config/frontendOrigin');

// Bachs (https://bachs.io) — hosted checkout + webhook, similar shape to Stripe/Flutterwave
// but the customer is fully redirected to a hosted page rather than an inline widget.
const BACHS_SECRET_KEY = process.env.BACHS_SECRET_KEY || '';
const BACHS_BASE_URL = BACHS_SECRET_KEY.startsWith('sk_sandbox_')
  ? 'https://sandbox-api.bachs.io'
  : 'https://api.bachs.io';
const FRONTEND_ORIGIN = getFrontendOrigin();

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
        // Bachs requires money as a decimal string at the currency's precision
        // (e.g. "3500.00", never a bare integer or minor units) — see
        // https://docs.bachs.io/guides/checkout/checkout-sessions
        pricing: { currency: pricing.currency, amount: amount.toFixed(2) },
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
      // Dev-only visibility into Bachs' real response shape (per docs.bachs.io):
      // checkout_id, checkout_url, status ("open"), expires_at, created_at — nothing
      // else. There is no charge_status/redirect_url on this endpoint; completion
      // only ever arrives later via the collection.succeeded webhook.
      console.log('[Bachs] checkout-session response:', {
        checkout_id: bachsData.checkout_id,
        checkout_url: bachsData.checkout_url,
        status: bachsData.status,
        expires_at: bachsData.expires_at
      });
    }

    await prisma.payment.update({
      where: { txRef },
      data: { checkoutId: bachsData.checkout_id || null }
    });

    if (!bachsData.checkout_url) {
      // Bachs returned 2xx but no URL to send the customer to — treat this as a
      // real failure rather than silently handing the frontend a dead end.
      await prisma.payment.update({ where: { txRef }, data: { status: 'FAILED' } });
      console.error('Bachs checkout-session response had no checkout_url:', bachsData);
      return res.status(502).json({ message: 'Payment provider did not return a checkout link. Please try again.' });
    }

    // A freshly created checkout session is always just "open" — Bachs has no
    // instant success/failure state at creation time. The webhook is the only
    // source of truth for the actual payment outcome (see /webhook below).
    return res.json({
      status: 'PENDING',
      redirectUrl: bachsData.checkout_url,
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
//
// Verification implements Bachs' REAL signing scheme (docs.bachs.io/guides/webhooks/overview):
// the signature is HMAC-SHA256 of "{timestamp}.{raw_body}", NOT of the raw body alone.
// Prefers the newer X-Bachs-Signature-V2 header (format: "t=<ts>,v1=<sig>[,v1=<sig>...]",
// carrying one v1= per currently-valid secret during a rotation — any match is accepted),
// falling back to the legacy X-Bachs-Timestamp + X-Bachs-Signature pair for older setups.
// A 5-minute tolerance window on the timestamp guards against replay of a captured payload.
router.post('/webhook', async (req, res, next) => {
  try {
    const secret = process.env.BACHS_WEBHOOK_SECRET;
    if (!secret || !req.rawBody) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    let timestamp = null;
    let candidateSignatures = [];

    const v2Header = req.headers['x-bachs-signature-v2'];
    if (v2Header) {
      const parts = Object.fromEntries(
        v2Header.split(',').filter(p => p.includes('=')).map(p => {
          const idx = p.indexOf('=');
          return [p.slice(0, idx), p.slice(idx + 1)];
        })
      );
      timestamp = parts.t ? parseInt(parts.t, 10) : null;
      candidateSignatures = v2Header.split(',')
        .filter(p => p.startsWith('v1='))
        .map(p => p.slice(3));
    } else {
      const legacySig = req.headers['x-bachs-signature'];
      const legacyTs = req.headers['x-bachs-timestamp'];
      if (legacySig && legacyTs) {
        timestamp = parseInt(legacyTs, 10);
        candidateSignatures = [legacySig];
      }
    }

    if (!timestamp || !candidateSignatures.length) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    // Reject stale/replayed deliveries — 5 minutes, matching Bachs' own reference implementation.
    if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    const expected = crypto.createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(req.rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);

    const isValidSignature = candidateSignatures.some(sig => {
      const sigBuf = Buffer.from(sig);
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    });

    if (!isValidSignature) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    // Acknowledge immediately; do the real work after.
    res.status(200).json({ received: true });

    const event = req.body;
    const data = event?.data || {};

    if (event?.type === 'collection.failed') {
      const txRef = event.metadata?.txRef || data.metadata?.txRef || null;
      const payment = txRef
        ? await prisma.payment.findUnique({ where: { txRef } })
        : (data.checkout_id ? await prisma.payment.findFirst({ where: { checkoutId: data.checkout_id } }) : null);
      if (payment && payment.status !== 'SUCCESSFUL') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', providerRef: data.charge_id || null } });
      }
      return;
    }

    if (event?.type !== 'collection.succeeded') return;

    // Bachs is a fairly new provider — try every plausible location for our own
    // reference before falling back to the checkout_id we stored ourselves at
    // initialize time (checkout_id is the one field guaranteed present per docs).
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
    if (payment.status === 'SUCCESSFUL') return; // already processed (at-least-once delivery)

    // Bachs sends status in caps ("SUCCEEDED") per docs.bachs.io — compare
    // case-insensitively rather than assuming a casing that isn't guaranteed.
    const isValid = String(data.status).toUpperCase() === 'SUCCEEDED'
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
