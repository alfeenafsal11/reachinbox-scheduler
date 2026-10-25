import fs from 'fs';
import path from 'path';
import { redis } from '../config/redis';
import { env } from '../config/env';

const DEFAULT_LUA_SCRIPT = `-- KEYS[1] = key prefix e.g. "rl:{senderId}"
-- ARGV[1] = nowMs, ARGV[2] = limit, ARGV[3] = maxWindowsAhead
local HOUR = 3600000
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local maxAhead = tonumber(ARGV[3])
local base = math.floor(now / HOUR) * HOUR
for i = 0, maxAhead do
  local windowStart = base + i * HOUR
  local key = KEYS[1] .. ":" .. windowStart
  local c = tonumber(redis.call('GET', key) or '0')
  if c < limit then
    local n = redis.call('INCR', key)
    redis.call('PEXPIRE', key, (i + 2) * HOUR)
    return { i, windowStart, n }
  end
end
return { -1, 0, 0 }
`;

function getLuaScript(): string {
  const candidates = [
    path.resolve(__dirname, 'scripts/reserveSlot.lua'),
    path.resolve(__dirname, '../../src/queue/scripts/reserveSlot.lua'),
    path.resolve(process.cwd(), 'src/queue/scripts/reserveSlot.lua'),
    path.resolve(process.cwd(), 'backend/src/queue/scripts/reserveSlot.lua'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return fs.readFileSync(c, 'utf8');
      }
    } catch {}
  }
  return DEFAULT_LUA_SCRIPT;
}

const luaScript = getLuaScript();

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
