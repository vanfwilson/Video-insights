import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp, ThumbsDown, Minus, Lightbulb, Check, AlertTriangle } from "lucide-react";

interface ReviewsAnalysis {
  sentimentSummary?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  suggestedCoreValue?: string;
  strengths?: string[];
  weaknesses?: string[];
}

interface ReviewsDisplayProps {
  clientBusinessId: number;
}

export function ReviewsDisplay({ clientBusinessId }: ReviewsDisplayProps) {
  const { data, isLoading, error } = useQuery<{ reviews: ReviewsAnalysis }>({
    queryKey: ['/api/intel/results', clientBusinessId, 'reviews'],
    queryFn: async () => {
      const res = await fetch(`/api/intel/results/${clientBusinessId}?type=reviews`);
      if (!res.ok) throw new Error('Failed to fetch reviews analysis');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="reviews-loading">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4" data-testid="reviews-error">
        Failed to load review analysis
      </div>
    );
  }

  const analysis = data?.reviews;

  if (!analysis) {
    return (
      <div className="text-muted-foreground p-4 text-center" data-testid="reviews-empty">
        No review analysis yet. Run Review Analysis first.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reviews-analysis">
      <h2 className="text-xl font-bold">Customer Review Analysis</h2>

      {analysis.sentimentSummary && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CardContent className="pt-6 text-center">
              <ThumbsUp className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                {analysis.sentimentSummary.positive}%
              </div>
              <div className="text-sm text-muted-foreground">Positive</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800">
            <CardContent className="pt-6 text-center">
              <Minus className="h-6 w-6 mx-auto text-gray-600 mb-2" />
              <div className="text-3xl font-bold text-gray-700 dark:text-gray-400">
                {analysis.sentimentSummary.neutral}%
              </div>
              <div className="text-sm text-muted-foreground">Neutral</div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <CardContent className="pt-6 text-center">
              <ThumbsDown className="h-6 w-6 mx-auto text-red-600 mb-2" />
              <div className="text-3xl font-bold text-red-700 dark:text-red-400">
                {analysis.sentimentSummary.negative}%
              </div>
              <div className="text-sm text-muted-foreground">Negative</div>
            </CardContent>
          </Card>
        </div>
      )}

      {analysis.suggestedCoreValue && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-primary" />
              Suggested Core Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg italic">"{analysis.suggestedCoreValue}"</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis.strengths && analysis.strengths.length > 0 && (
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
                <Check className="h-5 w-5" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {analysis.weaknesses && analysis.weaknesses.length > 0 && (
          <Card className="bg-red-50 dark:bg-red-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-red-800 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
