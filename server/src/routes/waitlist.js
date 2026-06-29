const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const validate = require('../middleware/validate');

const router = express.Router();

const waitlistSchema = z.object({
  email: z.string().trim().email().toLowerCase()
});

router.post('/', validate(waitlistSchema), async (req, res, next) => {
  try {
    const entry = await prisma.waitlistEmail.upsert({
      where: { email: req.body.email },
      update: {},
      create: { email: req.body.email }
    });

    return res.status(201).json({ entry });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
