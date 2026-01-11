import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import type { WorkbookProgress } from "@shared/schema";
import {
  Compass,
  Target,
  Grid3X3,
  GitBranch,
  Clock,
  ChevronRight,
  CheckCircle2,
  Circle,
  Sparkles,
  Lock,
  BookOpen,
} from "lucide-react";

const WORKBOOK_SECTIONS = [
  {
    id: "core-value",
    title: "Find Your Core Value",
    description: "Discover the one value that defines your business",
    icon: Compass,
    path: "/workbook/core-value",
    color: "bg-blue-500",
    darkColor: "dark:bg-blue-600",
    lightColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    accentText: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "swot-analysis",
    title: "SWOT Analysis",
    description: "Evaluate strengths, weaknesses, opportunities & threats",
    icon: Grid3X3,
    path: "/workbook/swot",
    color: "bg-emerald-500",
    darkColor: "dark:bg-emerald-600",
    lightColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    accentText: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "root-cause",
    title: "Root Cause Chart",
    description: "Chart the real problem blocking your growth",
    icon: GitBranch,
    path: "/workbook/root-cause",
    color: "bg-purple-500",
    darkColor: "dark:bg-purple-600",
    lightColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    accentText: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "time-audit",
    title: "Time Management",
    description: "Reclaim your time for high-value work",
    icon: Clock,
    path: "/workbook/time-audit",
    color: "bg-amber-500",
    darkColor: "dark:bg-amber-600",
    lightColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    accentText: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "action-plan",
    title: "90-Day Action Plan",
    description: "Turn your work into a concrete roadmap",
    icon: Target,
    path: "/workbook/action-plan",
    color: "bg-slate-700",
    darkColor: "dark:bg-slate-600",
    lightColor: "bg-slate-50 dark:bg-slate-900/50",
    borderColor: "border-slate-200 dark:border-slate-700",
    accentText: "text-slate-700 dark:text-slate-300",
  },
];

export default function WorkbookDashboard() {
  const { user } = useAuth();

  const { data: workbookProgress, isLoading } = useQuery<WorkbookProgress | null>({
    queryKey: ["/api/workbook/progress"],
    enabled: !!user,
  });

  const completedSections = workbookProgress?.completedSections || [];
  const completionPercentage = Math.round(
    (completedSections.length / WORKBOOK_SECTIONS.length) * 100
  );

  const getSectionStatus = (sectionId: string): "complete" | "available" | "locked" => {
    if (completedSections.includes(sectionId)) return "complete";
    const currentIndex = WORKBOOK_SECTIONS.findIndex((s) => s.id === sectionId);
    const previousComplete =
      currentIndex === 0 ||
      completedSections.includes(WORKBOOK_SECTIONS[currentIndex - 1]?.id);
    return previousComplete ? "available" : "locked";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-12 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 md:mb-12 mt-4 md:mt-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h1
            className="text-2xl md:text-4xl font-bold text-foreground mb-2"
            data-testid="text-workbook-title"
          >
            Pick One Workbook
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
            Work through each section to discover your core value, analyze your
            business, and create a focused 90-day action plan.
          </p>
        </div>

        <Card className="mb-8 border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Your Progress</h2>
                  <p className="text-sm text-muted-foreground">
                    {completedSections.length} of {WORKBOOK_SECTIONS.length} sections
                    complete
                  </p>
                </div>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {completionPercentage}%
                  </span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {WORKBOOK_SECTIONS.map((section, index) => {
            const status = getSectionStatus(section.id);
            const Icon = section.icon;

            return (
              <Card
                key={section.id}
                className={`overflow-visible transition-all duration-200 ${
                  status === "locked"
                    ? "opacity-60"
                    : "hover-elevate"
                } ${section.borderColor}`}
                data-testid={`card-section-${section.id}`}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl ${section.color} ${section.darkColor} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">
                          {section.title}
                        </h3>
                        {status === "complete" && (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                        {status === "locked" && (
                          <Badge
                            variant="secondary"
                            className="bg-muted text-muted-foreground flex-shrink-0"
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {section.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Step {index + 1} of {WORKBOOK_SECTIONS.length}
                        </span>

                        {status !== "locked" ? (
                          <Link href={section.path}>
                            <Button
                              variant={status === "complete" ? "outline" : "default"}
                              className="gap-2"
                              data-testid={`button-section-${section.id}`}
                            >
                              {status === "complete" ? "Review" : "Continue"}
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="ghost" disabled className="gap-2">
                            <Circle className="w-4 h-4" />
                            Locked
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  AI Coach Available
                </h3>
                <p className="text-muted-foreground mb-3 text-sm md:text-base">
                  Each section includes an AI coach that can ask clarifying questions,
                  suggest ideas based on your industry, and help you dig deeper into
                  the exercises.
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Powered by the Pick One methodology from Stephen Wright&apos;s 30 years
                  of consulting
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
