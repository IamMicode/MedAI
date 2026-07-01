const prisma = require('../db');

const FREE_DAILY_LIMIT = 10;

async function aiLimit(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Login required.' });

    // premium users have no limit
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    });
    if (user?.plan && user.plan !== 'FREE') return next();

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const usage = await prisma.aIUsage.upsert({
      where: { userId_date: { userId, date: today } },
      update: {},
      create: { userId, date: today, count: 0 }
    });

    if (usage.count >= FREE_DAILY_LIMIT) {
      return res.status(429).json({
        message: `Daily limit reached. Free users get ${FREE_DAILY_LIMIT} AI messages per day. Upgrade to Premium for unlimited access.`,
        limit: FREE_DAILY_LIMIT,
        used: usage.count,
        upgradeRequired: true
      });
    }

    // increment count
    await prisma.aIUsage.update({
      where: { userId_date: { userId, date: today } },
      data: { count: { increment: 1 } }
    });

    res.locals.aiUsage = { used: usage.count + 1, limit: FREE_DAILY_LIMIT };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = aiLimit;
