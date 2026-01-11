import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Building2, ChevronDown, ChevronUp, Lightbulb, 
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Calendar,
  MapPin, Target
} from "lucide-react";
import { format } from "date-fns";
import { SwotAnalysis } from "@/components/SwotAnalysis";
import type { ClientBusiness, SwotAnalysis as SwotAnalysisType } from "@shared/schema";

export default function SwotAnalysisPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [expandedClient, setExpandedClient] = useState<number | null>(null);

  const { data: clients = [], isLoading: clientsLoading } = useQuery<ClientBusiness[]>({
    queryKey: ["/api/leads/clients"],
    enabled: !!user,
  });

  if (authLoading || clientsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Please log in to view SWOT analyses.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SWOT Analysis</h1>
            <p className="text-muted-foreground">
              AI-powered competitive analysis for your client businesses
            </p>
          </div>
        </div>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Client Businesses Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add client businesses in the Local Leads page to generate SWOT analyses.
            </p>
            <Button onClick={() => window.location.href = "/leads"} data-testid="button-go-to-leads">
              <Building2 className="w-4 h-4 mr-2" />
              Go to Local Leads
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <ClientSwotCard
              key={client.id}
              client={client}
              isExpanded={expandedClient === client.id}
              onToggle={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientSwotCard({ 
  client, 
  isExpanded, 
  onToggle 
}: { 
  client: ClientBusiness; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const { toast } = useToast();

  const { data: swotAnalyses = [], isLoading: swotLoading, refetch } = useQuery<SwotAnalysisType[]>({
    queryKey: ["/api/leads/clients", client.id, "swot"],
    queryFn: async () => {
      const response = await fetch(`/api/leads/clients/${client.id}/swot`);
      if (!response.ok) throw new Error("Failed to fetch SWOT analyses");
      return response.json();
    },
    enabled: isExpanded,
    refetchInterval: (query) => {
      const latestSwot = query.state.data?.[0];
      if (latestSwot?.status === "generating" || latestSwot?.status === "pending") {
        return 3000;
      }
      return false;
    },
  });

  const generateSwotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/leads/clients/${client.id}/swot`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/clients", client.id, "swot"] });
      toast({ title: "SWOT analysis started", description: "This may take a moment..." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to generate SWOT analysis", 
        description: error.message || "Please run a lead search first to gather competitor data.",
        variant: "destructive" 
      });
    },
  });

  const latestSwot = swotAnalyses[0] || null;
  const hasCompletedSwot = latestSwot?.status === "completed";

  return (
    <Card data-testid={`card-swot-client-${client.id}`}>
      <CardHeader 
        className="cursor-pointer hover-elevate" 
        onClick={onToggle}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{client.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                {client.city}, {client.state}
                {client.keyword && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    {client.keyword}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasCompletedSwot && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                Analysis Available
              </Badge>
            )}
            {latestSwot?.status === "generating" && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="border-t pt-4">
          {swotLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <SwotAnalysis 
                analysis={latestSwot}
                isGenerating={generateSwotMutation.isPending}
                onGenerate={() => generateSwotMutation.mutate()}
              />
              
              {swotAnalyses.length > 1 && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Previous Analyses ({swotAnalyses.length - 1})
                  </h4>
                  <div className="space-y-2">
                    {swotAnalyses.slice(1).map((swot) => (
                      <div 
                        key={swot.id} 
                        className="flex items-center justify-between p-3 border rounded-md bg-muted/50"
                        data-testid={`card-swot-history-${swot.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={swot.status === "completed" ? "secondary" : "outline"}>
                            {swot.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {swot.createdAt && format(new Date(swot.createdAt), "MMM d, yyyy h:mm a")}
                          </span>
                          {swot.leadsAnalyzed && (
                            <span className="text-xs text-muted-foreground">
                              ({swot.leadsAnalyzed} leads analyzed)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
