import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { ActionPlan, CoreValue, SwotAnalysis, RootCauseChart, TimeAudit } from "@shared/schema";
import {
  Target,
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  Calendar,
  Sparkles,
  BookOpen,
  RefreshCw,
  Expand,
  Zap,
} from "lucide-react";

interface Milestone {
  title: string;
  weeks: string;
}

interface PlanTask {
  title: string;
  owner: string;
  dueWeek: number;
}

interface Metric {
  name: string;
  baseline: string;
  target: string;
  cadence: string;
}

interface GeneratedPlan {
  strategyLabel: string;
  milestones: Milestone[];
  tasks: PlanTask[];
  metrics: Metric[];
}

const STRATEGIES = [
  {
    id: "revise",
    label: "Revise (R)",
    icon: RefreshCw,
    description: "Fix the bottleneck, stabilize the cycle",
    color: "bg-blue-500",
  },
  {
    id: "expand",
    label: "Expand (E)",
    icon: Expand,
    description: "Scale what works, remove capacity ceiling",
    color: "bg-emerald-500",
  },
  {
    id: "disrupt",
    label: "Disrupt (D)",
    icon: Zap,
    description: "Reset pricing, differentiate your offer",
    color: "bg-purple-500",
  },
];

function generate90DayPlan(strategy: string, workbookData: { swot?: SwotAnalysis | null }): GeneratedPlan {
  const s = (strategy || "").toLowerCase();
  const issue = (workbookData.swot?.weaknesses as any)?.[0]?.text || "your #1 issue";
  const opp = (workbookData.swot?.opportunities as any)?.[0]?.text || "your #1 opportunity";
  const area = workbookData.swot?.businessArea || "your focus area";

  if (s.includes("revise") || s === "r") {
    return {
      strategyLabel: "Revise (R)",
      milestones: [
        { title: `Stabilize: stop the cycle around ${issue}`, weeks: "1-2" },
        { title: `Fix the bottleneck in ${area} with one new system`, weeks: "3-6" },
        { title: `Lock the gains: SOPs + scorecards to prevent relapse`, weeks: "7-12" },
      ],
      tasks: [
        { title: "Write the one-sentence problem statement", owner: "Owner", dueWeek: 1 },
        { title: `Identify the single bottleneck in ${area}`, owner: "Owner", dueWeek: 1 },
        { title: "Create a 2-page SOP for the bottleneck process", owner: "Ops", dueWeek: 3 },
        { title: "Add a weekly scorecard (3-5 numbers)", owner: "Owner", dueWeek: 4 },
        { title: "Run a 14-day test and review results", owner: "Owner", dueWeek: 6 },
        { title: "Document handoff + training checklist", owner: "Ops", dueWeek: 8 },
      ],
      metrics: [
        { name: "Cycle time (days)", baseline: "", target: "Down 20%", cadence: "weekly" },
        { name: "Rework / callbacks", baseline: "", target: "Down 30%", cadence: "weekly" },
        { name: "On-time completion %", baseline: "", target: "95%+", cadence: "weekly" },
      ],
    };
  }

  if (s.includes("expand") || s === "e") {
    return {
      strategyLabel: "Expand (E)",
      milestones: [
        { title: `Capacity: remove the ceiling in ${area}`, weeks: "1-3" },
        { title: `Scale: replicate what works to capture ${opp}`, weeks: "4-8" },
        { title: `Systemize: hire/train to sustain growth`, weeks: "9-12" },
      ],
      tasks: [
        { title: "Choose ONE growth lever (pricing, throughput, upsell, referrals)", owner: "Owner", dueWeek: 1 },
        { title: "Define your 'best customer' and one offer for them", owner: "Owner", dueWeek: 2 },
        { title: "Build a simple pipeline board (lead to won)", owner: "Sales", dueWeek: 3 },
        { title: "Add a weekly production plan (capacity vs demand)", owner: "Ops", dueWeek: 4 },
        { title: "Create a hiring/training checklist for the next role", owner: "Owner", dueWeek: 8 },
      ],
      metrics: [
        { name: "Qualified leads/week", baseline: "", target: "Up 25%", cadence: "weekly" },
        { name: "Close rate %", baseline: "", target: "Up 10%", cadence: "weekly" },
        { name: "Revenue per labor hour", baseline: "", target: "Up 15%", cadence: "weekly" },
      ],
    };
  }

  return {
    strategyLabel: "Disrupt (D)",
    milestones: [
      { title: "Reset: stop profit leaks + get pricing clarity", weeks: "1-2" },
      { title: `Differentiate: build a new offer around ${opp}`, weeks: "3-7" },
      { title: "Launch: validate with paid customers and iterate", weeks: "8-12" },
    ],
    tasks: [
      { title: "Compute true costs (labor, materials, overhead)", owner: "Owner", dueWeek: 1 },
      { title: "Raise/reshape pricing on one flagship offer", owner: "Owner", dueWeek: 2 },
      { title: "Draft a 'why choose us' promise (one sentence) + proof", owner: "Owner", dueWeek: 3 },
      { title: "Run 10 customer interviews to validate needs", owner: "Owner", dueWeek: 4 },
      { title: "Launch a 2-week paid pilot with a clear guarantee", owner: "Sales", dueWeek: 8 },
    ],
    metrics: [
      { name: "Gross margin %", baseline: "", target: "Up 10 pts", cadence: "weekly" },
      { name: "Average job value", baseline: "", target: "Up 15%", cadence: "weekly" },
      { name: "Profit/week", baseline: "", target: "positive & growing", cadence: "weekly" },
    ],
  };
}

export default function WorkbookActionPlan() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [notes, setNotes] = useState("");

  const { data: existingPlan, isLoading: planLoading } = useQuery<ActionPlan | null>({
    queryKey: ["/api/workbook/action-plan"],
    enabled: !!user,
  });

  const { data: coreValue } = useQuery<CoreValue | null>({
    queryKey: ["/api/workbook/core-value"],
    enabled: !!user,
  });

  const { data: swot } = useQuery<SwotAnalysis | null>({
    queryKey: ["/api/workbook/swot"],
    enabled: !!user,
  });

  const { data: rootCause } = useQuery<RootCauseChart | null>({
    queryKey: ["/api/workbook/root-cause"],
    enabled: !!user,
  });

  const { data: timeAudit } = useQuery<TimeAudit | null>({
    queryKey: ["/api/workbook/time-audit"],
    enabled: !!user,
  });

  useEffect(() => {
    if (existingPlan) {
      setSelectedStrategy(existingPlan.selectedStrategy || "");
      setNotes(existingPlan.notes || "");
      if (existingPlan.milestones) {
        setGeneratedPlan({
          strategyLabel: existingPlan.strategyLabel || "",
          milestones: existingPlan.milestones as Milestone[],
          tasks: (existingPlan.tasks as PlanTask[]) || [],
          metrics: (existingPlan.metrics as Metric[]) || [],
        });
      }
    }
  }, [existingPlan]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/workbook/action-plan", {
        selectedStrategy,
        strategyLabel: generatedPlan?.strategyLabel,
        milestones: generatedPlan?.milestones,
        tasks: generatedPlan?.tasks,
        metrics: generatedPlan?.metrics,
        notes,
        status: "complete",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbook/action-plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workbook/progress"] });
      toast({ title: "Action plan saved!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleSelectStrategy = (strategyId: string) => {
    setSelectedStrategy(strategyId);
    const plan = generate90DayPlan(strategyId, { swot });
    setGeneratedPlan(plan);
  };

  if (planLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-actionplan-title">
                90-Day Action Plan
              </h1>
              <p className="text-muted-foreground text-sm">
                Turn your workbook insights into action
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-actionplan"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Workbook Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {coreValue?.coreValueFinal && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground mb-1">Core Value</p>
                  <p className="font-medium">{coreValue.coreValueFinal}</p>
                </div>
              )}
              {rootCause?.problemStatement && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-muted-foreground mb-1">Problem Statement</p>
                  <p className="font-medium">{rootCause.problemStatement}</p>
                </div>
              )}
              {timeAudit?.hoursToReclaim ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-muted-foreground mb-1">Hours to Reclaim</p>
                  <p className="font-medium">{timeAudit.hoursToReclaim} hours/week</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Choose Your Strategy
              </CardTitle>
              <CardDescription>
                Based on your workbook, select the approach that fits your situation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STRATEGIES.map((strategy) => {
                  const Icon = strategy.icon;
                  const isSelected = selectedStrategy === strategy.id;
                  return (
                    <button
                      key={strategy.id}
                      onClick={() => handleSelectStrategy(strategy.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? `${strategy.color} border-transparent text-white`
                          : "border-border hover-elevate"
                      }`}
                      data-testid={`button-strategy-${strategy.id}`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
                      <h3 className={`font-semibold ${isSelected ? "text-white" : "text-foreground"}`}>
                        {strategy.label}
                      </h3>
                      <p className={`text-sm ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                        {strategy.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {generatedPlan && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedPlan.milestones.map((milestone, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                        <Badge variant="outline" className="flex-shrink-0">
                          Week {milestone.weeks}
                        </Badge>
                        <p className="font-medium">{milestone.title}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Key Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {generatedPlan.tasks.map((task, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">{task.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{task.owner}</Badge>
                          <Badge variant="outline">Week {task.dueWeek}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Metrics to Track</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {generatedPlan.metrics.map((metric, idx) => (
                      <div key={idx} className="p-4 bg-muted/50 rounded-lg">
                        <p className="font-medium text-sm mb-2">{metric.name}</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Target:</span>
                            <span className="font-medium">{metric.target}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Cadence:</span>
                            <span>{metric.cadence}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes, commitments, or reminders..."
                className="min-h-[100px]"
                data-testid="input-notes"
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => navigate("/workbook/time-audit")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Time Audit
          </Button>

          <Button
            onClick={() => {
              handleSave();
              navigate("/workbook");
            }}
            className="gap-2 bg-slate-700 hover:bg-slate-800"
            data-testid="button-complete"
          >
            Complete Workbook
            <CheckCircle2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
