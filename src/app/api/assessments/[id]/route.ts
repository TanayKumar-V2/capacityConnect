import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const assessmentId = (await params).id;

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
        questions: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Determine access: either owner, admin/trainer with access, or enrolled learner
    const isEnrolled = assessment.course.enrollments.length > 0;
    const isOwner = assessment.course.ownerId === user.id;
    
    // Simplification for RBAC: verify they are enrolled or the owner
    if (!isEnrolled && !isOwner) {
      return NextResponse.json({ error: 'Forbidden. You do not have access to this assessment.' }, { status: 403 });
    }

    // Strip the correctOption from the returned questions
    const safeQuestions = assessment.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options),
      order: q.order
    }));

    return NextResponse.json({
      id: assessment.id,
      title: assessment.title,
      description: assessment.description,
      difficulty: assessment.difficulty,
      questions: safeQuestions
    });
  } catch (error: unknown) {
    console.error('[Fetch Assessment Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch assessment' }, { status: 500 });
  }
}
