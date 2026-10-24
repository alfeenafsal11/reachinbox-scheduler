-- KEYS[1] = key prefix e.g. "rl:{senderId}"
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
