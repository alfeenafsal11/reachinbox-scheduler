import { Request, Response, NextFunction } from 'express';
import { slackService } from './slack.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class SlackController {
  connect(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const url = slackService.getConnectUrl(req.user.id);
    res.redirect(url);
  }

  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error_missing_params`);
        return;
      }

      await slackService.handleCallback(code, state);
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
    } catch (err) {
      logger.error({ err }, 'Error in Slack OAuth callback');
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
    }
  }

  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const status = await slackService.getStatus(req.user.id);
      res.json(status);
    } catch (err) {
      next(err);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await slackService.disconnect(req.user.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async testConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { webhookUrl, channel, teamName } = req.body;
      if (!webhookUrl) {
        res.status(400).json({ error: 'webhookUrl is required' });
        return;
      }

      await slackService.connectWebhookDirect(req.user.id, webhookUrl, channel, teamName);
      res.json({ message: 'Connected webhook successfully' });
    } catch (err) {
      next(err);
    }
  }
}

export const slackController = new SlackController();
