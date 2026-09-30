"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TrainerInsights {
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

export default function TrainerInsightsPage() {
  const [data, setData] = useState<TrainerInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/trainer/insights')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load insights. Make sure you have trainer privileges.');
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'destructive';
      case 'NEEDS_IMPROVEMENT': return 'warning';
      case 'DEVELOPING': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => status.replace('_', ' ');

  if (loading) return <div className="p-8">Loading trainer insights...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Trainer Insights</h1>
        <p className="text-muted-foreground mt-2">
          Monitor learner performance across your authorized courses.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.overview.totalCourses}</div>
            <p className="text-xs text-muted-foreground">Courses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.overview.totalLearners}</div>
            <p className="text-xs text-muted-foreground">Unique Learners</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.overview.totalAssessments}</div>
            <p className="text-xs text-muted-foreground">Assessments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.overview.totalAttempts}</div>
            <p className="text-xs text-muted-foreground">Completed Attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.overview.averagePerformance}%</div>
            <p className="text-xs text-muted-foreground">Global Avg Score</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Course Performance</CardTitle>
            <CardDescription>Overview of courses you manage.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.courses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No courses available for analytics.</p>
            ) : (
              <div className="space-y-4">
                {data.courses.map(course => (
                  <div key={course.courseId} className="flex justify-between items-center p-3 border rounded-lg bg-muted/10">
                    <div>
                      <p className="font-medium text-sm">{course.title}</p>
                      <p className="text-xs text-muted-foreground">{course.learnerCount} learners • {course.attemptCount} attempts</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{course.averagePerformance}%</div>
                      <p className="text-[10px] text-muted-foreground uppercase">Avg Score</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Common Skill Gaps</CardTitle>
            <CardDescription>Aggregate competency performance across your learners.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.competencies.length === 0 ? (
              <p className="text-muted-foreground text-sm">Not enough assessment data to calculate competency performance.</p>
            ) : (
              <div className="space-y-4">
                {data.competencies.map(comp => (
                  <div key={comp.competencyId} className="flex justify-between items-center p-3 border rounded-lg bg-muted/10">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">
                        {comp.name}
                        <Badge variant={getStatusColor(comp.status) as "default" | "destructive" | "outline" | "secondary"} className="text-[10px]">
                          {getStatusLabel(comp.status)}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">{comp.correctCount} / {comp.questionCount} correct answers</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{comp.performance}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
