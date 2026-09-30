import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/rbac';
import { calculateSkillGaps } from '@/lib/skills/skill-gap';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export async function GET() {
  try {
    const user = await requireUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:skill-gaps`,
      limit: RATE_LIMITS.skillGaps.limit,
      windowSeconds: RATE_LIMITS.skillGaps.windowSeconds
    });

    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    // Pass ONLY the authenticated user's ID
    const data = await calculateSkillGaps(user.id);

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[Skill Gaps Fetch Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch skill gaps' }, { status: 500 });
  }
}
