import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.get('/google', (req, res) => authController.redirectToGoogle(req, res));
router.get('/google/callback', (req, res, next) => authController.googleCallback(req, res, next));
router.post('/dev-login', (req, res, next) => authController.devLogin(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.getMe(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));

export const authRouter = router;
