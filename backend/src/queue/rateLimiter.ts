import fs from 'fs';
import path from 'path';
import { redis } from '../config/redis';
import { env } from '../config/env';

const luaScriptPath = path.resolve(__dirname, 'scripts/reserveSlot.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf8');

export interface SlotReservation {
  windowOffset: number;
  windowStart: number;
  position: number;
  runAt: number;
}

export class RateLimiter {
  async reserveSlot(
    senderId: string,
    limit: number,
    maxWindowsAhead = 24
  ): Promise<SlotReservation> {
    const now = Date.now();
    // Using hash tag {senderId} to keep Redis keys on the same slot
    const keyPrefix = `rl:{${senderId}}`;

    const result = (await redis.eval(
      luaScript,
      1,
      keyPrefix,
      now.toString(),
      limit.toString(),
      maxWindowsAhead.toString()
    )) as [number, number, number];

    const windowOffset = Number(result[0]);
    const windowStart = Number(result[1]);
    const position = Number(result[2]);

    if (windowOffset === 0) {
      // Current window has capacity, send immediately
      return {
        windowOffset: 0,
        windowStart,
        position,
        runAt: now,
      };
    }

    if (windowOffset === -1) {
      // All windows ahead are full: defer by 1 hour past max window and retry
      const HOUR = 3600000;
      const base = Math.floor(now / HOUR) * HOUR;
      const deferRunAt = base + (maxWindowsAhead + 1) * HOUR;
      return {
        windowOffset: -1,
        windowStart: deferRunAt,
        position: 1,
        runAt: deferRunAt,
      };
    }

    // Overflowed into a future window: compute runAt preserving order with MIN_DELAY
    const runAt = windowStart + (position - 1) * env.MIN_DELAY_BETWEEN_EMAILS_MS;

    return {
      windowOffset,
      windowStart,
      position,
      runAt,
    };
  }
}

export const rateLimiter = new RateLimiter();
