import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';

export class SlackService {
  getConnectUrl(userId: string): string {
    const state = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '10m' });
    const redirectUri = encodeURIComponent(env.SLACK_REDIRECT_URI);
    const scope = encodeURIComponent('incoming-webhook');

    return `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(state, env.JWT_SECRET) as { userId: string };
    } catch (err) {
      throw new Error('Invalid or expired OAuth state parameter');
    }

    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      incoming_webhook?: {
        url: string;
        channel?: string;
        configuration_url?: string;
      };
      team?: {
        id: string;
        name: string;
      };
    };

    if (!data.ok || !data.incoming_webhook?.url) {
      logger.error({ error: data.error }, 'Slack OAuth access token exchange failed');
      throw new Error(data.error || 'Slack access denied');
    }

    await prisma.slackConnection.upsert({
      where: { userId: decoded.userId },
      update: {
        webhookUrl: data.incoming_webhook.url,
        channel: data.incoming_webhook.channel || null,
        teamName: data.team?.name || null,
        connectedAt: new Date(),
      },
      create: {
        userId: decoded.userId,
        webhookUrl: data.incoming_webhook.url,
        channel: data.incoming_webhook.channel || null,
        teamName: data.team?.name || null,
      },
    });

    logger.info({ userId: decoded.userId, team: data.team?.name }, 'Slack connected successfully');
  }

  async connectWebhookDirect(userId: string, webhookUrl: string, channel?: string, teamName?: string) {
    return prisma.slackConnection.upsert({
      where: { userId },
      update: {
        webhookUrl,
        channel: channel || '#alerts',
        teamName: teamName || 'Workspace',
        connectedAt: new Date(),
      },
      create: {
        userId,
        webhookUrl,
        channel: channel || '#alerts',
        teamName: teamName || 'Workspace',
      },
    });
  }

  async getStatus(userId: string) {
    const conn = await prisma.slackConnection.findUnique({
      where: { userId },
      select: {
        channel: true,
        teamName: true,
        connectedAt: true,
      },
    });

    return {
      connected: !!conn,
      connection: conn,
    };
  }

  async disconnect(userId: string) {
    await prisma.slackConnection.deleteMany({
      where: { userId },
    });
    logger.info({ userId }, 'Slack connection disconnected');
    return { message: 'Slack disconnected successfully' };
  }
}

export const slackService = new SlackService();
