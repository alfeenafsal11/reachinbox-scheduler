import { Router } from 'express';
import { emailsController } from './emails.controller';
import { requireAuth } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { scheduleEmailSchema, listEmailsQuerySchema } from './schemas';

const router = Router();

router.use(requireAuth);

router.post(
  '/schedule',
  validateBody(scheduleEmailSchema),
  (req, res, next) => emailsController.schedule(req, res, next)
);

router.get(
  '/scheduled',
  validateQuery(listEmailsQuerySchema),
  (req, res, next) => emailsController.getScheduled(req, res, next)
);

router.get(
  '/sent',
  validateQuery(listEmailsQuerySchema),
  (req, res, next) => emailsController.getSent(req, res, next)
);

export const emailsRouter = router;
