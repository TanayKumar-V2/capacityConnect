"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface Question {
  id: string;
  question: string;
  options: string[];
  order: number;
}

interface Assessment {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  questions: Question[];
}

export default function AssessmentPage() {
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number, correct: number, total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/assessments/${assessmentId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load assessment');
        return res.json();
      })
      .then(data => {
        setAssessment(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [assessmentId]);

  const handleSubmit = async () => {
    if (!assessment) return;
    setSubmitting(true);
    
    const formattedAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
      questionId,
      selectedOption
    }));

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8">Loading assessment...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!assessment) return null;

  if (result) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assessment Complete</CardTitle>
            <CardDescription>{assessment.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center py-8">
            <div className="text-5xl font-bold text-primary">{result.score}%</div>
            <p className="text-xl">Score: {result.correct} / {result.total}</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => window.open('/dashboard', '_self')}>Return to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{assessment.title}</h1>
        {assessment.description && <p className="text-muted-foreground mt-2">{assessment.description}</p>}
      </div>

      <div className="space-y-8">
        {assessment.questions.map((q, idx) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-lg">Question {idx + 1}</CardTitle>
              <CardDescription className="text-base text-foreground mt-2 font-medium">{q.question}</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={answers[q.id]?.toString()} 
                onValueChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: parseInt(val) }))}
                className="space-y-3"
              >
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center space-x-3 bg-muted/30 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={optIdx.toString()} id={`${q.id}-${optIdx}`} />
                    <Label htmlFor={`${q.id}-${optIdx}`} className="flex-1 cursor-pointer">{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={handleSubmit} disabled={submitting || Object.keys(answers).length < assessment.questions.length}>
          {submitting ? 'Submitting...' : 'Submit Assessment'}
        </Button>
      </div>
    </div>
  );
}
