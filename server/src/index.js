require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./db');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const triageRoutes = require('./routes/triage');
const waitlistRoutes = require('./routes/waitlist');
const adminRoutes = require('./routes/admin');
const doctorRoutes = require('./routes/doctors');
const chatRoutes = require('./routes/chat');
const aiRoutes = require('./routes/ai');
const panicRoutes = require('./routes/panic');
const achievementsRoutes = require('./routes/achievements');
const therapyRoutes = require('./routes/therapy');
const doctorPortalRoutes = require('./routes/doctorPortal');
const paymentsRoutes = require('./routes/payments');

const { passport, configurePassport } = require('./passport');

const app = express();
const port = process.env.PORT || 5000;

configurePassport();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: '8mb' }));
app.use(passport.initialize());

app.get('/api/health', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, database: 'connected' });
  } catch (error) {
    return next(error);
  }
});

// ── ALL ROUTES MUST BE MOUNTED BEFORE THE 404 CATCH-ALL BELOW ──
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/panic', panicRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/therapy', therapyRoutes);
app.use('/api/doctor-portal', doctorPortalRoutes);
app.use('/api/payments', paymentsRoutes);

// ── 404 CATCH-ALL — must always be last, after every real route ──
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    message: error.message || 'Something went wrong on the server.'
  });
});

app.listen(port, () => {
  console.log(`MedAI API running on http://localhost:${port}`);
});
