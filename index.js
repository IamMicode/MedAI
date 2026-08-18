require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./db');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const triageRoutes = require('./routes/triage');
const panicRoutes = require('./routes/panic');
const waitlistRoutes = require('./routes/waitlist');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const therapyRoutes = require('./routes/therapy');
const achievementsRoutes = require('./routes/achievements');
const { passport, configurePassport } = require('./passport');

const app = express();
configurePassport();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/panic', panicRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/therapy', therapyRoutes);
app.use('/api/achievements', achievementsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error.' });
});

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`MedAI API running on http://localhost:${PORT}`));
