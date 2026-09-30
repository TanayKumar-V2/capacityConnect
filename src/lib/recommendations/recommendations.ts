import { prisma } from '../prisma';
import { calculateSkillGaps, CompetencyPerformance } from '../skills/skill-gap';

export interface Recommendation {
  id: string;
  type: 'COURSE';
  title: string;
  score: number;
  competency: {
    id: string;
    name: string;
    performance: number | null;
    status: string;
  };
  reason: string;
}

export async function getPersonalizedRecommendations(userId: string, limit: number = 5): Promise<{ recommendations: Recommendation[] }> {
  // 1. Get skill gaps
  const { competencies } = await calculateSkillGaps(userId);

  // 2. Filter target competencies
  const targetGaps = competencies.filter(c => 
    c.status === 'CRITICAL' || c.status === 'NEEDS_IMPROVEMENT' || c.status === 'DEVELOPING'
  );

  if (targetGaps.length === 0) {
    return { recommendations: [] };
  }

  // Rank target gaps by severity (lower performance = higher severity)
  targetGaps.sort((a, b) => {
    const perfA = a.performance ?? 0;
    const perfB = b.performance ?? 0;
    return perfA - perfB;
  });

  const gapIds = targetGaps.map(c => c.competencyId);

  // 3. Find authorized learning content
  // A learner is authorized if they are enrolled in the course, or they own it.
  const enrolledCourses = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true }
  });
  
  const courseIds = enrolledCourses.map(e => e.courseId);

  const courses = await prisma.course.findMany({
    where: {
      id: { in: courseIds },
      competencies: {
        some: { competencyId: { in: gapIds } }
      }
    },
    include: {
      competencies: true
    }
  });

  // 4. Rank items deterministically
  const recommendations: Recommendation[] = [];
  const dedupSet = new Set<string>();

  for (const course of courses) {
    if (dedupSet.has(course.id)) continue;

    // Find the highest priority gap this course addresses
    let primaryGap: CompetencyPerformance | undefined;
    let highestGapScore = -1;

    for (const compMapping of course.competencies) {
      const gap = targetGaps.find(g => g.competencyId === compMapping.competencyId);
      if (gap) {
        const perf = gap.performance ?? 0;
        const gapScore = 100 - perf;
        
        if (gapScore > highestGapScore) {
          highestGapScore = gapScore;
          primaryGap = gap;
        }
      }
    }

    if (!primaryGap) continue;

    // Scoring Formula
    // recommendationScore = gapScore * 0.70 + competencyMatch * 0.30
    // competencyMatch is simply 100 since there is a direct CourseCompetency relationship.
    const recommendationScore = Math.round((highestGapScore * 0.70) + (100 * 0.30));

    recommendations.push({
      id: course.id,
      type: 'COURSE',
      title: course.title,
      score: recommendationScore,
      competency: {
        id: primaryGap.competencyId,
        name: primaryGap.name,
        performance: primaryGap.performance,
        status: primaryGap.status
      },
      reason: `Recommended because your ${primaryGap.name} performance is ${primaryGap.performance}% and this course targets that competency.`
    });

    dedupSet.add(course.id);
  }

  // 5. Deterministic Sort
  recommendations.sort((a, b) => {
    // 1. recommendationScore DESC
    if (b.score !== a.score) return b.score - a.score;
    // 2. competency name ASC
    if (a.competency.name !== b.competency.name) return a.competency.name.localeCompare(b.competency.name);
    // 3. course title ASC
    if (a.title !== b.title) return a.title.localeCompare(b.title);
    // 4. courseId ASC
    return a.id.localeCompare(b.id);
  });

  return { recommendations: recommendations.slice(0, limit) };
}
