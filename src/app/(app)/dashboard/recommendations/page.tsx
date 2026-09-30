"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';

interface Recommendation {
  id: string;
  type: string;
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

export default function RecommendationsPage() {
  const [data, setData] = useState<{ recommendations: Recommendation[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recommendations?limit=5')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load recommendations');
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

  if (loading) return <div className="p-8">Analyzing personalized learning paths...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Personalized Learning</h1>
        <p className="text-muted-foreground mt-2">
          Content recommended specifically for you based on your skill gaps.
        </p>
      </div>

      {data.recommendations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center">
            <BookOpen className="h-12 w-12 text-primary/20 mb-4" />
            <p className="text-lg font-medium text-foreground">You&apos;re all caught up!</p>
            <p className="mt-2">You are currently proficient in all assessed competencies, or you haven&apos;t taken any assessments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.recommendations.map(rec => (
            <Card key={rec.id} className="flex flex-col h-full hover:border-primary/50 transition-colors">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="text-xs uppercase bg-primary/5">{rec.type}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">Match: {rec.score}%</span>
                </div>
                <CardTitle className="text-xl line-clamp-2">{rec.title}</CardTitle>
                <CardDescription className="flex flex-col gap-2 mt-3 border-t pt-3">
                  <span className="font-semibold text-foreground flex justify-between items-center text-sm">
                    {rec.competency.name}
                    <Badge variant={getStatusColor(rec.competency.status) as "default" | "destructive" | "outline" | "secondary"} className="text-[10px]">
                      {getStatusLabel(rec.competency.status)}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Your performance: {rec.competency.performance}%
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 text-sm bg-muted/20 m-4 rounded-md p-3 border">
                <strong className="block mb-1 text-xs">Why this is recommended:</strong>
                <p className="text-muted-foreground text-xs">{rec.reason}</p>
              </CardContent>
              <CardFooter className="pt-2 border-t mt-auto">
                <Button className="w-full" asChild>
                  <Link href={`/courses/${rec.id}`}>Start Learning</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
