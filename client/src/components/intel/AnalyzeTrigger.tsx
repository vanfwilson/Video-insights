import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Users, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ClientBusiness {
  id: number;
  name: string;
  keyword: string;
  address?: string;
  city?: string;
  state?: string;
  googleBusinessUrl?: string;
}

interface AnalyzeTriggerProps {
  clientBusiness: ClientBusiness;
  onAnalysisStarted?: () => void;
}

type AnalysisAction = 'reviews' | 'competitors' | 'partnerships';

export function AnalyzeTrigger({ clientBusiness, onAnalysisStarted }: AnalyzeTriggerProps) {
  const { toast } = useToast();
  const [currentAction, setCurrentAction] = useState<AnalysisAction[] | null>(null);

  const mutation = useMutation({
    mutationFn: async (actions: AnalysisAction[]) => {
      const geo = [clientBusiness.city, clientBusiness.state]
        .filter(Boolean)
        .join(', ') || clientBusiness.address || '';

      return apiRequest('POST', '/api/intel/analyze', {
        clientBusinessId: clientBusiness.id,
        businessType: clientBusiness.keyword,
        businessName: clientBusiness.name,
        geo,
        actions,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Analysis Started",
        description: "Processing will take 30-60 seconds. Results will appear automatically.",
      });
      onAnalysisStarted?.();
      setCurrentAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to start analysis",
        variant: "destructive",
      });
      setCurrentAction(null);
    },
  });

  const triggerAnalysis = (actions: AnalysisAction[]) => {
    setCurrentAction(actions);
    mutation.mutate(actions);
  };

  const isLoading = mutation.isPending;

  return (
    <div className="flex flex-wrap gap-2" data-testid="analyze-trigger">
      <Button
        onClick={() => triggerAnalysis(['reviews'])}
        disabled={isLoading}
        variant="outline"
        data-testid="btn-analyze-reviews"
      >
        {isLoading && currentAction?.includes('reviews') && !currentAction?.includes('partnerships') ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4 mr-2" />
        )}
        Analyze Reviews
      </Button>

      <Button
        onClick={() => triggerAnalysis(['partnerships'])}
        disabled={isLoading}
        variant="outline"
        data-testid="btn-find-partners"
      >
        {isLoading && currentAction?.includes('partnerships') && !currentAction?.includes('reviews') ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Users className="h-4 w-4 mr-2" />
        )}
        Find Partners
      </Button>

      <Button
        onClick={() => triggerAnalysis(['reviews', 'competitors', 'partnerships'])}
        disabled={isLoading}
        data-testid="btn-full-analysis"
      >
        {isLoading && currentAction?.length === 3 ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Zap className="h-4 w-4 mr-2" />
        )}
        Full Analysis
      </Button>

      {isLoading && (
        <span className="text-sm text-muted-foreground self-center ml-2">
          Processing... (30-60 sec)
        </span>
      )}
    </div>
  );
}
