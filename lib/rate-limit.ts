// Best-effort in-memory sliding-window rate limiter.
// Works per serverless instance — stops casual spam/abuse.
// For strict global limits across Vercel instances, swap with Upstash Redis later.

const hits = new Map<string, number[]>();

function prune(key: string, windowMs: number) {
  const now = Date.now();
  const arr = hits.get(key) || [];
  const fresh = arr.filter((t) => now - t < windowMs);
  hits.set(key, fresh);
  // occasional full cleanup to avoid unbounded growth
  if (hits.size > 5000 && Math.random() < 0.01) {
    for (const [k, v] of hits) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) hits.delete(k);
    }
  }
  return fresh;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; resetMs: number } {
  const fresh = prune(key, windowMs);
  if (fresh.length >= limit) {
    const oldest = fresh[0];
    return { ok: false, remaining: 0, resetMs: oldest + windowMs - Date.now() };
  }
  fresh.push(Date.now());
  hits.set(key, fresh);
  return { ok: true, remaining: limit - fresh.length, resetMs: windowMs };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export function rateLimitHeaders(remaining: number, limit: number, resetMs: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
  };
}
