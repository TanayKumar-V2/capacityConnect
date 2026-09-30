import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:assessment-submit`,
      limit: RATE_LIMITS.assessmentSubmit.limit,
      windowSeconds: RATE_LIMITS.assessmentSubmit.windowSeconds
    });

    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    const assessmentId = (await params).id;
    const body = await req.json();
    const { answers } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid answers payload' }, { status: 400 });
    }

    // 1. Authorization Check
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        course: {
          include: {
            enrollments: {
              where: { userId: user.id }
            }
          }
        },
        questions: true
      }
    });

    if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    
    if (assessment.course.enrollments.length === 0 && assessment.course.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Deterministic Grading
    let correctCount = 0;
    const answerRecords: { questionId: string; selectedOption: number; isCorrect: boolean }[] = [];
    const questionMap = new Map(assessment.questions.map(q => [q.id, q]));

    for (const submitted of answers) {
      const qId = submitted.questionId;
      const selected = submitted.selectedOption;
      
      if (typeof selected !== 'number') {
        return NextResponse.json({ error: 'Invalid selection format' }, { status: 400 });
      }

      const dbQuestion = questionMap.get(qId);
      if (!dbQuestion) continue; // Skip invalid IDs silently or throw, skipping here

      const isCorrect = (selected === dbQuestion.correctOption);
      if (isCorrect) correctCount++;

      answerRecords.push({
        questionId: qId,
        selectedOption: selected,
        isCorrect
      });
    }

    const totalQuestions = assessment.questions.length;
    const scorePercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // 3. Save Attempt Transactionally
    const attempt = await prisma.$transaction(async (tx) => {
      const newAttempt = await tx.assessmentAttempt.create({
        data: {
          assessmentId,
          learnerId: user.id,
          score: scorePercentage,
          status: 'SUBMITTED',
          startedAt: new Date(),
          submittedAt: new Date()
        }
      });

      if (answerRecords.length > 0) {
        await tx.assessmentAnswer.createMany({
          data: answerRecords.map(a => ({
            ...a,
            attemptId: newAttempt.id
          }))
        });
      }

      return newAttempt;
    });

    // 4. Return Result
    return NextResponse.json({
      attemptId: attempt.id,
      score: attempt.score,
      correct: correctCount,
      total: totalQuestions,
      percentage: scorePercentage
    });

  } catch (error: unknown) {
    console.error('[Assessment Submit Error]:', error);
    return NextResponse.json({ error: 'Failed to process submission' }, { status: 500 });
  }
}
