import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/rbac';
import { getPersonalizedRecommendations } from '@/lib/recommendations/recommendations';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:recommendations`,
      limit: RATE_LIMITS.recommendations.limit,
      windowSeconds: RATE_LIMITS.recommendations.windowSeconds
    });

    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    let limit = 5;

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 10) {
        limit = parsedLimit;
      }
    }

    // Server-side identity
    const data = await getPersonalizedRecommendations(user.id, limit);

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[Recommendations Fetch Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
