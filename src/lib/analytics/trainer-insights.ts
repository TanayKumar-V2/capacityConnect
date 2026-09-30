import { prisma } from '../prisma';

export interface TrainerInsights {
  overview: {
    totalCourses: number;
    totalLearners: number;
    totalAssessments: number;
    totalAttempts: number;
    averagePerformance: number;
  };
  courses: {
    courseId: string;
    title: string;
    learnerCount: number;
    assessmentCount: number;
    attemptCount: number;
    averagePerformance: number;
  }[];
  competencies: {
    competencyId: string;
    name: string;
    performance: number;
    status: string;
    questionCount: number;
    correctCount: number;
  }[];
  assessments: {
    assessmentId: string;
    title: string;
    courseId: string;
    courseTitle: string;
    attemptCount: number;
    averageScore: number;
  }[];
}

const THRESHOLDS = {
  CRITICAL: 50,
  NEEDS_IMPROVEMENT: 70,
  DEVELOPING: 85
};

export async function getTrainerInsights(userId: string): Promise<TrainerInsights> {
  // 1. Authorization: Verify user is a TRAINER or ADMIN
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } }
  });

  const isTrainer = user?.roles.some(r => r.role.name === 'TRAINER' || r.role.name === 'ADMIN');
  if (!isTrainer) {
    throw new Error('Unauthorized. Only trainers and admins can view insights.');
  }

  // 2. Identify Authorized Courses
  // Assuming a course has an ownerId field. If it's an admin, they might see all courses in their org.
  // For simplicity based on prompt, we limit to courses they explicitly own.
  const courses = await prisma.course.findMany({
    where: { ownerId: userId },
    include: {
      assessments: {
        include: {
          attempts: {
            where: { status: 'SUBMITTED' },
            include: {
              answers: {
                include: {
                  question: true
                }
              }
            }
          }
        }
      },
      enrollments: true
    }
  });

  // Data aggregations
  const totalCourses = courses.length;
  let totalAssessments = 0;
  let totalAttempts = 0;
  
  const uniqueLearnerIds = new Set<string>();
  const courseAnalytics: TrainerInsights['courses'] = [];
  const assessmentAnalytics: TrainerInsights['assessments'] = [];
  
  let globalScoreSum = 0;
  let globalScoreCount = 0;

  // Competency maps
  const compQuestionCount = new Map<string, number>();
  const compCorrectCount = new Map<string, number>();
  const compNames = new Map<string, string>();

  // Iterate over courses
  for (const course of courses) {
    let courseAttemptCount = 0;
    let courseScoreSum = 0;
    
    // Add unique enrolled learners
    for (const e of course.enrollments) {
      uniqueLearnerIds.add(e.userId);
    }
    
    const courseLearnerCount = new Set(course.enrollments.map(e => e.userId)).size;

    for (const assessment of course.assessments) {
      totalAssessments++;
      
      const assessmentAttemptCount = assessment.attempts.length;
      let assessmentScoreSum = 0;

      for (const attempt of assessment.attempts) {
        totalAttempts++;
        courseAttemptCount++;
        
        assessmentScoreSum += attempt.score || 0;
        courseScoreSum += attempt.score || 0;
        
        globalScoreSum += attempt.score || 0;
        globalScoreCount++;

        // Aggregate competency data
        for (const answer of attempt.answers) {
          const compId = answer.question.competencyId;
          if (!compId) continue;

          // Note: Competency names aren't eagerly loaded in this query map, so we will fetch them after.
          const qc = compQuestionCount.get(compId) || 0;
          const cc = compCorrectCount.get(compId) || 0;

          compQuestionCount.set(compId, qc + 1);
          compCorrectCount.set(compId, cc + (answer.isCorrect ? 1 : 0));
        }
      }

      assessmentAnalytics.push({
        assessmentId: assessment.id,
        title: assessment.title,
        courseId: course.id,
        courseTitle: course.title,
        attemptCount: assessmentAttemptCount,
        averageScore: assessmentAttemptCount > 0 ? Math.round(assessmentScoreSum / assessmentAttemptCount) : 0
      });
    }

    courseAnalytics.push({
      courseId: course.id,
      title: course.title,
      learnerCount: courseLearnerCount,
      assessmentCount: course.assessments.length,
      attemptCount: courseAttemptCount,
      averagePerformance: courseAttemptCount > 0 ? Math.round(courseScoreSum / courseAttemptCount) : 0
    });
  }

  // Competency Analytics
  const competencyIds = Array.from(compQuestionCount.keys());
  const competencyRecords = await prisma.competency.findMany({
    where: { id: { in: competencyIds } }
  });

  for (const comp of competencyRecords) {
    compNames.set(comp.id, comp.name);
  }

  const competencyAnalytics: TrainerInsights['competencies'] = [];
  for (const compId of competencyIds) {
    const qc = compQuestionCount.get(compId) || 0;
    const cc = compCorrectCount.get(compId) || 0;
    const perf = qc > 0 ? Math.round((cc / qc) * 100) : 0;
    
    let status = 'PROFICIENT';
    if (perf < THRESHOLDS.CRITICAL) status = 'CRITICAL';
    else if (perf < THRESHOLDS.NEEDS_IMPROVEMENT) status = 'NEEDS_IMPROVEMENT';
    else if (perf < THRESHOLDS.DEVELOPING) status = 'DEVELOPING';

    competencyAnalytics.push({
      competencyId: compId,
      name: compNames.get(compId) || 'Unknown',
      performance: perf,
      status,
      questionCount: qc,
      correctCount: cc
    });
  }

  // Sort competency gaps by severity
  competencyAnalytics.sort((a, b) => a.performance - b.performance);
  courseAnalytics.sort((a, b) => a.title.localeCompare(b.title));
  assessmentAnalytics.sort((a, b) => a.title.localeCompare(b.title));

  return {
    overview: {
      totalCourses,
      totalLearners: uniqueLearnerIds.size,
      totalAssessments,
      totalAttempts,
      averagePerformance: globalScoreCount > 0 ? Math.round(globalScoreSum / globalScoreCount) : 0
    },
    courses: courseAnalytics,
    competencies: competencyAnalytics,
    assessments: assessmentAnalytics
  };
}
