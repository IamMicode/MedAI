const prisma = require('../db');

/**
 * Create a notification for a user. Never throws — a notification failing to
 * write should never break the action that triggered it (sending a message,
 * accepting an appointment, etc.), so errors are swallowed and logged.
 */
async function notify(userId, { type, title, body, link }) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body, link: link || null }
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

module.exports = notify;
