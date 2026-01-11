import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { RootCauseChart } from "@shared/schema";
import {
  GitBranch,
  ArrowLeft,
  ArrowRight,
  Save,
  Sparkles,
  Loader2,
  ArrowDown,
  HelpCircle,
  Target,
  AlertCircle,
} from "lucide-react";

interface FiveWhyItem {
  question: string;
  answer: string;
}

interface FormData {
  beforeTriggers: string;
  problemDescription: string;
  afterResults: string;
  fiveWhys: FiveWhyItem[];
  whenWhereHow: string;
  whoAffected: string;
  whenNotIssue: string;
  whatDriving: string;
  conditionsWorse: string;
  howStopForever: string;
  whoWinsLoses: string;
  whatStoppingUs: string;
  symptom: string;
  rootCause: string;
  priorityImpact: string;
  problemStatement: string;
}

export default function WorkbookRootCause() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentWhyAnswer, setCurrentWhyAnswer] = useState("");

  const [formData, setFormData] = useState<FormData>({
    beforeTriggers: "",
    problemDescription: "",
    afterResults: "",
    fiveWhys: [],
    whenWhereHow: "",
    whoAffected: "",
    whenNotIssue: "",
    whatDriving: "",
    conditionsWorse: "",
    howStopForever: "",
    whoWinsLoses: "",
    whatStoppingUs: "",
    symptom: "",
    rootCause: "",
    priorityImpact: "",
    problemStatement: "",
  });

  const { data: existingData, isLoading } = useQuery<RootCauseChart | null>({
    queryKey: ["/api/workbook/root-cause"],
    enabled: !!user,
  });

  useEffect(() => {
    if (existingData) {
      setFormData({
        beforeTriggers: existingData.beforeTriggers || "",
        problemDescription: existingData.problemDescription || "",
        afterResults: existingData.afterResults || "",
        fiveWhys: (existingData.fiveWhys as FiveWhyItem[]) || [],
        whenWhereHow: existingData.whenWhereHow || "",
        whoAffected: existingData.whoAffected || "",
        whenNotIssue: existingData.whenNotIssue || "",
        whatDriving: existingData.whatDriving || "",
        conditionsWorse: existingData.conditionsWorse || "",
        howStopForever: existingData.howStopForever || "",
        whoWinsLoses: existingData.whoWinsLoses || "",
        whatStoppingUs: existingData.whatStoppingUs || "",
        symptom: existingData.symptom || "",
        rootCause: existingData.rootCause || "",
        priorityImpact: existingData.priorityImpact || "",
        problemStatement: existingData.problemStatement || "",
      });
    }
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<FormData>) => {
      const res = await apiRequest("POST", "/api/workbook/root-cause", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbook/root-cause"] });
      toast({ title: "Progress saved!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleFieldChange = (field: keyof FormData, value: string | FiveWhyItem[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addWhyAnswer = () => {
    if (!currentWhyAnswer.trim()) return;
    const newWhy: FiveWhyItem = {
      question: `Why #${formData.fiveWhys.length + 1}`,
      answer: currentWhyAnswer.trim(),
    };
    setFormData((prev) => ({
      ...prev,
      fiveWhys: [...prev.fiveWhys, newWhy],
    }));
    setCurrentWhyAnswer("");
  };

  const generateProblemStatement = async () => {
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/workbook/ai-coach", {
        section: "root-cause",
        action: "generate_problem_statement",
        currentAnswers: formData,
      });
      const data = await res.json();
      if (data.response) {
        setFormData((prev) => ({ ...prev, problemStatement: data.response }));
        toast({ title: "Problem statement generated!" });
      }
    } catch (error) {
      toast({ title: "AI unavailable", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading) {
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
            <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-rootcause-title">
                Root Cause Chart
              </h1>
              <p className="text-muted-foreground text-sm">
                Identify the real problem blocking your growth
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-rootcause"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-purple-500" />
                Problem Flow
              </CardTitle>
              <CardDescription>
                Map out what happens before, during, and after the problem occurs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="beforeTriggers">What triggers the problem? (Before)</Label>
                <Textarea
                  id="beforeTriggers"
                  value={formData.beforeTriggers}
                  onChange={(e) => handleFieldChange("beforeTriggers", e.target.value)}
                  placeholder="What conditions or events lead to the problem occurring?"
                  className="min-h-[100px]"
                  data-testid="input-before-triggers"
                />
              </div>
              <div className="flex justify-center">
                <ArrowDown className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="problemDescription">Describe the problem (During)</Label>
                <Textarea
                  id="problemDescription"
                  value={formData.problemDescription}
                  onChange={(e) => handleFieldChange("problemDescription", e.target.value)}
                  placeholder="What exactly happens? Be specific about what you observe."
                  className="min-h-[100px]"
                  data-testid="input-problem-description"
                />
              </div>
              <div className="flex justify-center">
                <ArrowDown className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="afterResults">What results from the problem? (After)</Label>
                <Textarea
                  id="afterResults"
                  value={formData.afterResults}
                  onChange={(e) => handleFieldChange("afterResults", e.target.value)}
                  placeholder="What are the consequences? How does it impact your business?"
                  className="min-h-[100px]"
                  data-testid="input-after-results"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-500" />
                The 5 Whys
              </CardTitle>
              <CardDescription>
                Keep asking "Why?" to dig down to the root cause
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.fiveWhys.map((why, idx) => (
                <div key={idx} className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">{why.question}</p>
                  <p className="text-foreground">{why.answer}</p>
                </div>
              ))}

              {formData.fiveWhys.length < 5 && (
                <div className="space-y-2">
                  <Label>
                    Why #{formData.fiveWhys.length + 1}:{" "}
                    {formData.fiveWhys.length === 0
                      ? "Why does this problem occur?"
                      : `Why is "${formData.fiveWhys[formData.fiveWhys.length - 1]?.answer}" happening?`}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={currentWhyAnswer}
                      onChange={(e) => setCurrentWhyAnswer(e.target.value)}
                      placeholder="Because..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addWhyAnswer();
                      }}
                      data-testid={`input-why-${formData.fiveWhys.length + 1}`}
                    />
                    <Button onClick={addWhyAnswer} data-testid="button-add-why">
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {formData.fiveWhys.length >= 5 && (
                <Badge className="bg-emerald-500">You've completed 5 Whys!</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                Root Cause Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="symptom">The Symptom (what you see)</Label>
                <Input
                  id="symptom"
                  value={formData.symptom}
                  onChange={(e) => handleFieldChange("symptom", e.target.value)}
                  placeholder="The visible problem..."
                  data-testid="input-symptom"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rootCause">The Root Cause (the real issue)</Label>
                <Input
                  id="rootCause"
                  value={formData.rootCause}
                  onChange={(e) => handleFieldChange("rootCause", e.target.value)}
                  placeholder="The underlying cause..."
                  data-testid="input-root-cause"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="problemStatement">Problem Statement</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateProblemStatement}
                    disabled={aiLoading}
                    className="gap-2"
                    data-testid="button-generate-statement"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate with AI
                  </Button>
                </div>
                <Textarea
                  id="problemStatement"
                  value={formData.problemStatement}
                  onChange={(e) => handleFieldChange("problemStatement", e.target.value)}
                  placeholder="A clear, concise statement of the problem and its root cause..."
                  className="min-h-[100px]"
                  data-testid="input-problem-statement"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => navigate("/workbook/swot")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SWOT
          </Button>

          <Button
            onClick={() => {
              handleSave();
              navigate("/workbook/time-audit");
            }}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
            data-testid="button-continue"
          >
            Continue to Time Audit
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
