import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SwotItem } from "@shared/schema";

interface SwotAnalysisProps {
  analysis: {
    id: number;
    status: string;
    summary?: string | null;
    strengths?: SwotItem[] | null;
    weaknesses?: SwotItem[] | null;
    opportunities?: SwotItem[] | null;
    threats?: SwotItem[] | null;
    leadsAnalyzed?: number | null;
    createdAt?: Date | null;
    errorMessage?: string | null;
  } | null;
  isGenerating?: boolean;
  onGenerate?: () => void;
}

export function SwotAnalysis({ analysis, isGenerating, onGenerate }: SwotAnalysisProps) {
  if (!analysis && !isGenerating) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">No SWOT analysis available yet.</p>
          {onGenerate && (
            <Button onClick={onGenerate} data-testid="button-generate-swot">
              <Lightbulb className="w-4 h-4 mr-2" />
              Generate SWOT Analysis
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isGenerating || analysis?.status === "generating" || analysis?.status === "pending") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Analyzing competitor data and generating SWOT analysis...</p>
          <p className="text-xs text-muted-foreground mt-2">This may take a moment</p>
        </CardContent>
      </Card>
    );
  }

  if (analysis?.status === "error") {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-destructive" />
          <p className="text-destructive mb-2">Failed to generate analysis</p>
          <p className="text-sm text-muted-foreground mb-4">{analysis.errorMessage}</p>
          {onGenerate && (
            <Button onClick={onGenerate} variant="outline" data-testid="button-retry-swot">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {analysis?.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              Executive Summary
              {analysis.leadsAnalyzed && (
                <Badge variant="secondary" className="text-xs">
                  Based on {analysis.leadsAnalyzed} competitors
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{analysis.summary}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SwotQuadrant
          title="Strengths"
          items={analysis?.strengths || []}
          icon={<TrendingUp className="w-4 h-4" />}
          colorClass="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
          headerColor="bg-green-500/10"
        />
        <SwotQuadrant
          title="Weaknesses"
          items={analysis?.weaknesses || []}
          icon={<TrendingDown className="w-4 h-4" />}
          colorClass="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
          headerColor="bg-red-500/10"
        />
        <SwotQuadrant
          title="Opportunities"
          items={analysis?.opportunities || []}
          icon={<Lightbulb className="w-4 h-4" />}
          colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          headerColor="bg-blue-500/10"
        />
        <SwotQuadrant
          title="Threats"
          items={analysis?.threats || []}
          icon={<AlertTriangle className="w-4 h-4" />}
          colorClass="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
          headerColor="bg-orange-500/10"
        />
      </div>

      {onGenerate && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onGenerate} data-testid="button-regenerate-swot">
            <RefreshCw className="w-4 h-4 mr-2" />
            Regenerate Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

function SwotQuadrant({
  title,
  items,
  icon,
  colorClass,
  headerColor,
}: {
  title: string;
  items: SwotItem[];
  icon: React.ReactNode;
  colorClass: string;
  headerColor: string;
}) {
  return (
    <Card className={`border ${colorClass.split(' ').find(c => c.startsWith('border-')) || ''}`}>
      <CardHeader className={`pb-2 ${headerColor}`}>
        <CardTitle className={`text-sm font-medium flex items-center gap-2 ${colorClass.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
          {icon}
          {title}
          <Badge variant="outline" className="ml-auto text-xs">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No items identified</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={index} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">-</span>
                  <div className="flex-1">
                    <p>{item.text}</p>
                    {item.source && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Source: {item.source}
                      </p>
                    )}
                  </div>
                  {item.confidence && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs flex-shrink-0 ${
                        item.confidence === 'high' 
                          ? 'border-green-500/50 text-green-600 dark:text-green-400' 
                          : item.confidence === 'medium' 
                            ? 'border-yellow-500/50 text-yellow-600 dark:text-yellow-400' 
                            : 'border-gray-500/50 text-gray-500'
                      }`}
                    >
                      {item.confidence}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default SwotAnalysis;
