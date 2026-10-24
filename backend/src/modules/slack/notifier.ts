import { redis } from '../../config/redis';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';

export class SlackNotifier {
  async notifyRateLimitHit(params: {
    userId: string;
    senderId: string;
    senderEmail: string;
    hourlyLimit: number;
    delayedCount: number;
    nextWindowStart: number;
  }): Promise<void> {
    const { userId, senderId, senderEmail, hourlyLimit, delayedCount, nextWindowStart } = params;

    try {
      // Dedupe flag: notify at most once per sender per window
      const flagKey = `slack:notified:${senderId}:${nextWindowStart}`;
      const acquired = await redis.set(flagKey, '1', 'EX', 3600, 'NX');
      if (!acquired) {
        // Already notified for this window
        return;
      }

      // Dynamic lookup of user's active Slack connection
      const slackConnection = await prisma.slackConnection.findUnique({
        where: { userId },
      });

      if (!slackConnection) {
        // User has not connected Slack, return silently
        return;
      }

      const nextWindowDate = new Date(nextWindowStart).toLocaleString();
      const message = {
        text: `⚠️ *Hourly Rate Limit Exceeded* for sender \`${senderEmail}\`.\n• Limit: *${hourlyLimit} emails/hour*\n• Queued/delayed emails: *${delayedCount}*\n• Next available window begins: *${nextWindowDate}*\nOrdering is preserved and emails will resume automatically.`,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(slackConnection.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404 || response.status === 410) {
        logger.warn({ userId }, 'Slack webhook URL is stale/expired. Deleting connection.');
        await prisma.slackConnection.delete({ where: { userId } }).catch(() => {});
        return;
      }

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Slack webhook returned non-OK status');
      } else {
        logger.info({ senderEmail, userId }, 'Slack rate-limit alert sent successfully');
      }
    } catch (err) {
      // Slack failures must never block sending
      logger.error({ err }, 'Error sending Slack rate-limit alert (ignored)');
    }
  }
}

export const slackNotifier = new SlackNotifier();
