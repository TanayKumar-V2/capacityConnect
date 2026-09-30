import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/rbac';
import { generateAssessment } from '@/lib/ai/assessment-generator';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:assessment-generation`,
      limit: RATE_LIMITS.assessmentGeneration.limit,
      windowSeconds: RATE_LIMITS.assessmentGeneration.windowSeconds
    });

    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    const body = await req.json();
    const { courseId, title, questionCount, difficulty } = body;

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'Invalid courseId.' }, { status: 400 });
    }
    
    if (!title || typeof title !== 'string' || title.length > 200) {
      return NextResponse.json({ error: 'Invalid title.' }, { status: 400 });
    }

    if (typeof questionCount !== 'number' || questionCount < 1 || questionCount > 20) {
      return NextResponse.json({ error: 'Question count must be between 1 and 20.' }, { status: 400 });
    }

    if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty level.' }, { status: 400 });
    }

    const assessment = await generateAssessment({
      userId: user.id,
      organizationId: user.organizationId,
      courseId,
      title,
      questionCount,
      difficulty
    });

    return NextResponse.json({ success: true, assessment });
  } catch (error: unknown) {
    console.error('[Generate Assessment Error]:', error);
    const errorMsg = error instanceof Error ? error.message : 'An error occurred during assessment generation.';
    
    // Convert common known validation failures into 403 or 400
    if (errorMsg.includes('Unauthorized') || errorMsg.includes('access denied')) {
      return NextResponse.json({ error: errorMsg }, { status: 403 });
    }
    if (errorMsg.includes('Duplicate') || errorMsg.includes('Insufficient') || errorMsg.includes('invalid')) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'The assessment generator is temporarily unavailable.' }, { status: 500 });
  }
}
