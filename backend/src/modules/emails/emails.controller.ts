import { Request, Response, NextFunction } from 'express';
import { emailsService } from './emails.service';

export class EmailsController {
  async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await emailsService.scheduleEmails(req.user.id, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;

      const result = await emailsService.getScheduledEmails(req.user.id, page, pageSize);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;

      const result = await emailsService.getSentEmails(req.user.id, page, pageSize);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const emailsController = new EmailsController();
