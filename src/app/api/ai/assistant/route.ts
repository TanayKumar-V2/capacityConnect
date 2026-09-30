import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/rbac';
import { askLearningAssistant } from '@/lib/ai/assistant';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    // 1. Authenticate user from existing session utilities
    const user = await requireUser();
    
    // Safety check - requireUser handles redirect if missing, but just in case
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized. Organization isolated session required.' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:assistant`,
      limit: RATE_LIMITS.assistant.limit,
      windowSeconds: RATE_LIMITS.assistant.windowSeconds
    });

    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    // 2. Parse request body
    const body = await req.json();
    const { message, courseId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message must be a non-empty string.' }, { status: 400 });
    }
    
    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message exceeds 2000 characters maximum length.' }, { status: 400 });
    }

    // 3. Call secure Assistant Service
    // The backend derives userId and organizationId strictly from the authenticated session
    // Never trusting a client-supplied userId.
    const result = await askLearningAssistant(user.id, user.organizationId, message, courseId);

    // 4. Return result
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[AI Assistant Error]:', error);
    return NextResponse.json({ error: 'The Learning Assistant is temporarily unavailable. Please try again.' }, { status: 500 });
  }
}
