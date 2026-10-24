import { Router } from 'express';
import { slackController } from './slack.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// OAuth initiation requires login
router.get('/connect', requireAuth, (req, res) => slackController.connect(req, res));

// OAuth callback from Slack (contains signed state JWT)
router.get('/callback', (req, res, next) => slackController.callback(req, res, next));

// Status and disconnect
router.get('/status', requireAuth, (req, res, next) => slackController.status(req, res, next));
router.delete('/', requireAuth, (req, res, next) => slackController.disconnect(req, res, next));
router.post('/test-connect', requireAuth, (req, res, next) => slackController.testConnect(req, res, next));

export const slackRouter = router;
