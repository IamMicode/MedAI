const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' }
});

// Doctor sign-in gets its OWN counters (not authLimiter's shared bucket) so
// doctor traffic can't eat a patient's attempts or vice versa behind one NAT.
// Login counts only FAILED attempts (status >= 400): a clinic full of doctors
// behind one hospital IP can all sign in successfully, while password guessing
// is still capped at 20 wrong tries per 15 minutes per client IP.
// The client IP is req.ip; index.js sets `trust proxy` to exactly 1 hop (Render's
// load balancer), so a spoofed leading X-Forwarded-For entry is ignored.
const doctorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' }
});

// Registration creates rows and runs bcrypt, so every attempt counts.
const doctorRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again later.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many AI requests. Please slow down and try again.' }
});

// Checkout creation is a rare, deliberate action for a real user — nobody
// legitimately clicks "Upgrade to Premium" more than a couple of times in
// 15 minutes. Tight window matches authLimiter's, since both guard
// infrequent-but-sensitive actions rather than routine traffic.
const paymentInitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many payment attempts. Please wait a few minutes and try again.' }
});

// The frontend polls this after returning from a real checkout to confirm
// payment status — needs real headroom, this is just a ceiling against a
// runaway poll loop, not protection against cost (status checks are a
// cheap local DB read, not a call to Bachs).
const paymentStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many status checks. Please slow down.' }
});

// Health Tools entries are cheap, DB-only writes with no external cost —
// this is a ceiling against a buggy loop or scripted abuse, not a limit
// meant to be felt during normal use (logging a few meals or tapping
// water/sleep trackers in quick succession should never come close to it).
const healthLogLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again.' }
});

module.exports = { authLimiter, doctorLoginLimiter, doctorRegisterLimiter, aiLimiter, paymentInitLimiter, paymentStatusLimiter, healthLogLimiter };
