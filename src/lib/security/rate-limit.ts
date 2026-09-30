import { Redis } from '@upstash/redis';

// Only instantiate Redis if environment variables exist
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = (redisUrl && redisToken) 
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

interface RateLimitParams {
  key: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  assistant: { limit: 20, windowSeconds: 600 }, // 20 per 10 mins
  assessmentGeneration: { limit: 10, windowSeconds: 600 }, // 10 per 10 mins
  assessmentSubmit: { limit: 30, windowSeconds: 60 }, // 30 per min
  recommendations: { limit: 60, windowSeconds: 60 }, // 60 per min
  skillGaps: { limit: 60, windowSeconds: 60 }, // 60 per min
  trainerInsights: { limit: 30, windowSeconds: 60 }, // 30 per min
};

export async function checkRateLimit(params: RateLimitParams): Promise<{ success: boolean; error?: string }> {
  // Fail-open strategy: If Redis isn't configured/available, allow the request.
  if (!redis) {
    console.warn('[RateLimiter]: Redis not configured. Bypassing rate limit.');
    return { success: true };
  }

  try {
    const { key, limit, windowSeconds } = params;
    
    // Atomic increment using pipeline
    const p = redis.pipeline();
    p.incr(key);
    p.expire(key, windowSeconds);
    const results = await p.exec();
    
    // results[0] is the result of incr
    const currentRequests = results[0] as number;

    if (currentRequests > limit) {
      return { success: false, error: 'Too many requests. Please try again later.' };
    }

    return { success: true };
  } catch (err) {
    console.error('[RateLimiter]: Redis error', err);
    // Fail-open on actual Redis crash to avoid blocking production on infrastructure failure
    return { success: true };
  }
}
