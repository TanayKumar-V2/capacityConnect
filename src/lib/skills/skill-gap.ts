import { prisma } from '../prisma';

export const SKILL_GAP_THRESHOLDS = {
  CRITICAL: 50,
  NEEDS_IMPROVEMENT: 70,
  DEVELOPING: 85,
  PROFICIENT: 100
};

export type SkillStatus = 'CRITICAL' | 'NEEDS_IMPROVEMENT' | 'DEVELOPING' | 'PROFICIENT' | 'NOT_ASSESSED';

export interface CompetencyPerformance {
  competencyId: string;
  name: string;
  performance: number | null;
  status: SkillStatus;
  evidence: {
    attemptCount: number;
    questionCount: number;
    correctCount: number;
  };
}

export async function calculateSkillGaps(userId: string): Promise<{ competencies: CompetencyPerformance[] }> {
  // 1. Fetch competencies from enrolled courses (or all available to the user context if global)
  // For simplicity, we fetch all competencies tied to courses the user is enrolled in.
  const enrolledCourses = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true }
  });
  
  const courseIds = enrolledCourses.map(e => e.courseId);
  
  const competencies = await prisma.competency.findMany({
    where: {
      courses: {
        some: { courseId: { in: courseIds } }
      }
    }
  });

  // 2. Fetch the latest SUBMITTED attempts for this learner in their authorized courses
  const latestAttempts = await prisma.assessmentAttempt.findMany({
    where: {
      learnerId: userId,
      status: 'SUBMITTED',
      assessment: {
        courseId: { in: courseIds }
      }
    },
    orderBy: { submittedAt: 'desc' }, // Latest first
    include: {
      answers: {
        include: {
          question: true
        }
      }
    }
  });

  // Dedup attempts by assessmentId to only count the most recent attempt per assessment
  const dedupedAttempts = new Map<string, typeof latestAttempts[0]>();
  for (const attempt of latestAttempts) {
    if (!dedupedAttempts.has(attempt.assessmentId)) {
      dedupedAttempts.set(attempt.assessmentId, attempt);
    }
  }

  // 3. Aggregate evidence by competency
  const evidenceMap = new Map<string, { attemptCount: number, questionCount: number, correctCount: number, assessmentIds: Set<string> }>();

  for (const comp of competencies) {
    evidenceMap.set(comp.id, { attemptCount: 0, questionCount: 0, correctCount: 0, assessmentIds: new Set() });
  }

  for (const attempt of dedupedAttempts.values()) {
    for (const answer of attempt.answers) {
      const compId = answer.question.competencyId;
      if (compId && evidenceMap.has(compId)) {
        const ev = evidenceMap.get(compId)!;
        ev.questionCount++;
        if (answer.isCorrect) ev.correctCount++;
        ev.assessmentIds.add(attempt.assessmentId);
      }
    }
  }

  // 4. Calculate gaps
  const results: CompetencyPerformance[] = competencies.map(comp => {
    const ev = evidenceMap.get(comp.id)!;
    const attemptCount = ev.assessmentIds.size;
    
    let performance: number | null = null;
    let status: SkillStatus = 'NOT_ASSESSED';
    
    if (ev.questionCount > 0) {
      performance = Math.round((ev.correctCount / ev.questionCount) * 100);
      
      if (performance < SKILL_GAP_THRESHOLDS.CRITICAL) {
        status = 'CRITICAL';
      } else if (performance < SKILL_GAP_THRESHOLDS.NEEDS_IMPROVEMENT) {
        status = 'NEEDS_IMPROVEMENT';
      } else if (performance < SKILL_GAP_THRESHOLDS.DEVELOPING) {
        status = 'DEVELOPING';
      } else {
        status = 'PROFICIENT';
      }
    }

    return {
      competencyId: comp.id,
      name: comp.name,
      performance,
      status,
      evidence: {
        attemptCount,
        questionCount: ev.questionCount,
        correctCount: ev.correctCount
      }
    };
  });

  return { competencies: results };
}
