import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/rbac';
import { getTrainerInsights } from '@/lib/analytics/trainer-insights';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export async function GET() {
  try {
    const user = await requireUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:trainer-insights`,
      limit: RATE_LIMITS.trainerInsights.limit,
      windowSeconds: RATE_LIMITS.trainerInsights.windowSeconds
    });

    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    const data = await getTrainerInsights(user.id);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[Trainer Insights Error]:', error);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to load trainer insights.' }, { status: 500 });
  }
}
