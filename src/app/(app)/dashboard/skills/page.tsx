"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SkillGapResult {
  competencies: {
    competencyId: string;
    name: string;
    performance: number | null;
    status: 'CRITICAL' | 'NEEDS_IMPROVEMENT' | 'DEVELOPING' | 'PROFICIENT' | 'NOT_ASSESSED';
    evidence: {
      attemptCount: number;
      questionCount: number;
      correctCount: number;
    };
  }[];
}

export default function SkillsDashboardPage() {
  const [data, setData] = useState<SkillGapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/skills/gaps')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load skills');
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
      case 'NEEDS_IMPROVEMENT': return 'warning'; // requires a warning variant or fallback to secondary
      case 'DEVELOPING': return 'secondary';
      case 'PROFICIENT': return 'default';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ');
  };

  if (loading) return <div className="p-8">Analyzing skills...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">My Skills</h1>
        <p className="text-muted-foreground mt-2">
          Your skill gaps are calculated automatically based on your latest assessment attempts.
        </p>
      </div>

      <div className="space-y-6">
        {data.competencies.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              You do not have any competencies mapped to your enrolled courses yet.
            </CardContent>
          </Card>
        ) : (
          data.competencies.map(comp => (
            <Card key={comp.competencyId}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>{comp.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {comp.status === 'NOT_ASSESSED' 
                      ? 'No completed assessments available.' 
                      : `Based on ${comp.evidence.attemptCount} assessment attempt(s)`}
                  </CardDescription>
                </div>
                <Badge variant={getStatusColor(comp.status) as "default" | "destructive" | "outline" | "secondary"}>
                  {getStatusLabel(comp.status)}
                </Badge>
              </CardHeader>
              <CardContent className="pt-4">
                {comp.status !== 'NOT_ASSESSED' && comp.performance !== null && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-muted-foreground">Performance</span>
                      <span className="font-bold">{comp.performance}%</span>
                    </div>
                    <Progress value={comp.performance} className="h-2" />
                    
                    <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-md border mt-4">
                      <strong>Evidence:</strong> You answered {comp.evidence.correctCount} out of {comp.evidence.questionCount} questions correctly in your latest attempts for this skill.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
