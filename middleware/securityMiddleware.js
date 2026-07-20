const rateLimitBuckets = new Map();

const normalizeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createRateLimiter = ({ namespace, windowMs, max, message }) => {
  const limitWindowMs = normalizeNumber(windowMs, 15 * 60 * 1000);
  const maxRequests = normalizeNumber(max, 100);

  return (req, res, next) => {
    const now = Date.now();
    const key = `${namespace}:${req.ip}:${req.originalUrl.split("?")[0]}`;
    const current =
      rateLimitBuckets.get(key) || { count: 0, resetAt: now + limitWindowMs };

    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + limitWindowMs;
    }

    current.count += 1;
    rateLimitBuckets.set(key, current);

    if (current.count > maxRequests) {
      return res.status(429).json({ message });
    }

    if (rateLimitBuckets.size > 10000) {
      for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
        if (bucket.resetAt <= now) {
          rateLimitBuckets.delete(bucketKey);
        }
      }
    }

    next();
  };
};

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
};

const apiRateLimiter = createRateLimiter({
  namespace: "api",
  windowMs: process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.API_RATE_LIMIT_MAX || 1000,
  message: "Too many requests. Please try again later.",
});

const authRateLimiter = createRateLimiter({
  namespace: "auth",
  windowMs: process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.LOGIN_RATE_LIMIT_MAX || 20,
  message: "Too many login attempts. Please try again later.",
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  securityHeaders,
};
