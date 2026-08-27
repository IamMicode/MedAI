const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const prisma = require('../db');

router.use(requireAuth);

// Achievement definitions
const ACHIEVEMENTS = [
  {
    id: 'first_triage',
    name: 'First Steps',
    desc: 'Completed your first triage session',
    icon: '🏆',
    color: 'rgba(255,215,0,0.15)',
    border: 'rgba(255,215,0,0.35)',
    check: (data) => ({ unlocked: data.triageCount >= 1, progress: Math.min(data.triageCount, 1), total: 1 })
  },
  {
    id: 'quick_check',
    name: 'Quick Check',
    desc: 'Complete 5 triage sessions',
    icon: '⚡',
    color: 'rgba(0,212,255,0.1)',
    border: 'rgba(0,212,255,0.3)',
    check: (data) => ({ unlocked: data.triageCount >= 5, progress: Math.min(data.triageCount, 5), total: 5 })
  },
  {
    id: 'lab_rat',
    name: 'Lab Rat',
    desc: 'Complete 50 triage sessions',
    icon: '🔬',
    color: 'rgba(168,85,247,0.1)',
    border: 'rgba(168,85,247,0.3)',
    check: (data) => ({ unlocked: data.triageCount >= 50, progress: Math.min(data.triageCount, 50), total: 50 })
  },
  {
    id: 'mind_master',
    name: 'Mind Master',
    desc: 'Use Mental Health AI 10 times',
    icon: '🧠',
    color: 'rgba(168,85,247,0.1)',
    border: 'rgba(168,85,247,0.3)',
    check: (data) => ({ unlocked: data.mentalAI >= 10, progress: Math.min(data.mentalAI, 10), total: 10 })
  },
  {
    id: 'iron_body',
    name: 'Iron Body',
    desc: 'Use Physical Health AI 10 times',
    icon: '💪',
    color: 'rgba(236,72,153,0.1)',
    border: 'rgba(236,72,153,0.3)',
    check: (data) => ({ unlocked: data.physicalAI >= 10, progress: Math.min(data.physicalAI, 10), total: 10 })
  },
  {
    id: 'heart_talker',
    name: 'Heart Talker',
    desc: 'Use Emotional AI 10 times',
    icon: '💭',
    color: 'rgba(236,72,153,0.1)',
    border: 'rgba(236,72,153,0.3)',
    check: (data) => ({ unlocked: data.emotionalAI >= 10, progress: Math.min(data.emotionalAI, 10), total: 10 })
  },
  {
    id: 'medical_scholar',
    name: 'Medical Scholar',
    desc: 'Use Medical Health AI 10 times',
    icon: '🏥',
    color: 'rgba(0,212,255,0.1)',
    border: 'rgba(0,212,255,0.3)',
    check: (data) => ({ unlocked: data.medicalAI >= 10, progress: Math.min(data.medicalAI, 10), total: 10 })
  },
  {
    id: 'calm_pressure',
    name: 'Calm Under Pressure',
    desc: 'Used Panic Mode when you needed it most',
    icon: '🚨',
    color: 'rgba(255,77,109,0.1)',
    border: 'rgba(255,77,109,0.3)',
    check: (data) => ({ unlocked: data.panicCount >= 1, progress: Math.min(data.panicCount, 1), total: 1 })
  },
  {
    id: 'breathwork_pro',
    name: 'Breathwork Pro',
    desc: 'Completed grounding checklist in Panic Mode 3 times',
    icon: '🌬️',
    color: 'rgba(0,255,136,0.1)',
    border: 'rgba(0,255,136,0.3)',
    check: (data) => ({ unlocked: data.groundingComplete >= 3, progress: Math.min(data.groundingComplete, 3), total: 3 })
  },
  {
    id: 'committed',
    name: 'Committed',
    desc: 'Been on MedAI for 30+ days',
    icon: '📅',
    color: 'rgba(0,255,136,0.1)',
    border: 'rgba(0,255,136,0.3)',
    check: (data) => ({ unlocked: data.accountAgeDays >= 30, progress: Math.min(data.accountAgeDays, 30), total: 30 })
  },
  {
    id: 'veteran',
    name: 'Veteran',
    desc: 'Been on MedAI for 90+ days',
    icon: '🎖️',
    color: 'rgba(255,215,0,0.1)',
    border: 'rgba(255,215,0,0.3)',
    check: (data) => ({ unlocked: data.accountAgeDays >= 90, progress: Math.min(data.accountAgeDays, 90), total: 90 })
  },
  {
    id: 'profile_complete',
    name: 'Know Thyself',
    desc: 'Filled out your complete health profile',
    icon: '✅',
    color: 'rgba(0,212,255,0.1)',
    border: 'rgba(0,212,255,0.3)',
    check: (data) => ({ unlocked: data.profileComplete, progress: data.profileComplete ? 1 : 0, total: 1 })
  },
  {
    id: 'premium_member',
    name: 'Premium Member',
    desc: 'Upgraded to MedAI Premium',
    icon: '👑',
    color: 'rgba(255,170,51,0.1)',
    border: 'rgba(255,170,51,0.3)',
    check: (data) => ({ unlocked: data.isPremium, progress: data.isPremium ? 1 : 0, total: 1 })
  }
];

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // fetch all data in parallel
    const [user, triageRecords, panicEvents, aiUsageAll] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.triageRecord.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.panicEvent.findMany({ where: { userId } }),
      prisma.aIUsage.findMany({ where: { userId } })
    ]);

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // compute total AI usage by type from daily logs
    const totalAIUsage = aiUsageAll.reduce((sum, row) => sum + (row.count || 0), 0);

    // account age in days
    const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // profile completeness check
    const profileComplete = !!(
      user.firstname && user.lastname && user.bloodGroup &&
      user.height && user.weight && user.emergName && user.emergPhone
    );

    // grounding completions from panic events
    const groundingComplete = panicEvents.filter(e => e.groundingComplete).length;

    // build data object for achievement checks
    const data = {
      triageCount: triageRecords.length,
      panicCount: panicEvents.length,
      groundingComplete,
      accountAgeDays,
      profileComplete,
      isPremium: user.plan !== 'Free',
      totalAIUsage,
      // individual AI type counts — approximate from total since we track combined daily
      // these will improve once we track per-type usage
      mentalAI: Math.floor(totalAIUsage * 0.25),
      physicalAI: Math.floor(totalAIUsage * 0.25),
      emotionalAI: Math.floor(totalAIUsage * 0.25),
      medicalAI: Math.floor(totalAIUsage * 0.25)
    };

    // compute achievements
    const achievements = ACHIEVEMENTS.map(ach => {
      const result = ach.check(data);
      return {
        id: ach.id,
        name: ach.name,
        desc: ach.desc,
        icon: ach.icon,
        color: ach.color,
        border: ach.border,
        unlocked: result.unlocked,
        progress: result.progress,
        total: result.total
      };
    });

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return res.json({
      achievements,
      stats: {
        unlocked: unlockedCount,
        total: ACHIEVEMENTS.length,
        triageCount: triageRecords.length,
        panicCount: panicEvents.length,
        accountAgeDays,
        totalAIMessages: totalAIUsage
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
