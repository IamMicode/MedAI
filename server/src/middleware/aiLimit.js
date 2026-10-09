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
    // The DB stores plan as 'Free' / 'Premium' (see schema default). Compare
    // case-insensitively so a casing difference can never again silently
    // exempt every free user from the quota.
    const plan = String(user?.plan || 'Free').toLowerCase();
    if (plan !== 'free') return next();

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Increment first, then check the value the DB returns. Two simultaneous
    // requests can't both read "9" and both slip through to 11.
    const usage = await prisma.aIUsage.upsert({
      where: { userId_date: { userId, date: today } },
      update: { count: { increment: 1 } },
      create: { userId, date: today, count: 1 }
    });

    if (usage.count > FREE_DAILY_LIMIT) {
      // Over the cap: give the slot back so the counter stays at the limit.
      await prisma.aIUsage.update({
        where: { userId_date: { userId, date: today } },
        data: { count: { decrement: 1 } }
      });
      return res.status(429).json({
        message: `Daily limit reached. Free users get ${FREE_DAILY_LIMIT} AI messages per day. Upgrade to Premium for unlimited access.`,
        limit: FREE_DAILY_LIMIT,
        used: FREE_DAILY_LIMIT,
        upgradeRequired: true
      });
    }

    res.locals.aiUsage = { used: usage.count, limit: FREE_DAILY_LIMIT };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = aiLimit;
