import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';

const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  `${env.BACKEND_URL}/auth/google/callback`
);

export class AuthService {
  getGoogleAuthUrl(): string {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
    });
  }

  async handleGoogleCallback(code: string): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.id_token) {
      throw new Error('No ID token returned by Google');
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new Error('Invalid Google user payload');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];
    const avatarUrl = payload.picture || null;

    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        email,
        name,
        avatarUrl,
      },
      create: {
        googleId,
        email,
        name,
        avatarUrl,
      },
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in via Google OAuth');

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { token, user };
  }

  // Developer bypass helper for local testing when credentials aren't configured yet
  async devLogin(email: string = 'demo@reachinbox.local', name: string = 'Demo User'): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    const googleId = `dev-google-${email}`;
    const user = await prisma.user.upsert({
      where: { googleId },
      update: { email, name },
      create: {
        googleId,
        email,
        name,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { token, user };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        slack: {
          select: {
            channel: true,
            teamName: true,
            connectedAt: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      slack: user.slack,
      slackConnected: !!user.slack,
    };
  }
}

export const authService = new AuthService();
