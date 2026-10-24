import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class AuthController {
  redirectToGoogle(_req: Request, res: Response): void {
    const url = authService.getGoogleAuthUrl();
    res.redirect(url);
  }

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
        return;
      }

      const { token } = await authService.handleGoogleCallback(code);

      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect(`${env.FRONTEND_URL}/dashboard`);
    } catch (err) {
      logger.error({ err }, 'Google OAuth callback error');
      res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }

  async devLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = (req.body?.email as string) || 'demo@reachinbox.local';
      const name = (req.body?.name as string) || 'Demo User';

      const { token, user } = await authService.devLogin(email, name);

      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        message: 'Logged in successfully',
        token,
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await authService.getMe(req.user.id);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  logout(_req: Request, res: Response): void {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.json({ message: 'Logged out successfully' });
  }
}

export const authController = new AuthController();
