import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { CoreValue } from "@shared/schema";
import {
  Compass,
  ArrowLeft,
  ArrowRight,
  Save,
  Sparkles,
  Loader2,
  CheckCircle2,
  MessageCircle,
  Lightbulb,
  Target,
  Heart,
  Users,
  Building2,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Foundation", description: "What shaped you and your business" },
  { id: 2, title: "Reflection", description: "Dig into the heart issues you solve" },
  { id: 3, title: "Draft Your Core Value", description: "Put it into words" },
  { id: 4, title: "Alignment Check", description: "Rate how your business reflects this value" },
];

const BUSINESS_AREAS = [
  { id: "products", label: "Products & Services", icon: Building2 },
  { id: "marketing", label: "Marketing", icon: Target },
  { id: "sales", label: "Sales", icon: Users },
  { id: "operations", label: "Operations", icon: Building2 },
  { id: "finance", label: "Finance", icon: Building2 },
  { id: "territory", label: "Territory", icon: Target },
  { id: "people", label: "People", icon: Users },
  { id: "tech", label: "Tech", icon: Building2 },
  { id: "assets", label: "Assets", icon: Building2 },
  { id: "structure", label: "Structure", icon: Building2 },
];

interface FormData {
  howYouWereMade: string;
  businessGiven: string;
  desireForCustomers: string;
  problemsYouSolve: string;
  principleAtHeart: string;
  feelingsGenerated: string;
  coreValueDraft1: string;
  coreValueDraft2: string;
  coreValueFinal: string;
  alignmentScores: Record<string, number>;
}

export default function WorkbookCoreValue() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [showAICoach, setShowAICoach] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiMessage, setAiMessage] = useState("");

  const [formData, setFormData] = useState<FormData>({
    howYouWereMade: "",
    businessGiven: "",
    desireForCustomers: "",
    problemsYouSolve: "",
    principleAtHeart: "",
    feelingsGenerated: "",
    coreValueDraft1: "",
    coreValueDraft2: "",
    coreValueFinal: "",
    alignmentScores: {},
  });

  const { data: existingCoreValue, isLoading } = useQuery<CoreValue | null>({
    queryKey: ["/api/workbook/core-value"],
    enabled: !!user,
  });

  useEffect(() => {
    if (existingCoreValue) {
      setFormData({
        howYouWereMade: existingCoreValue.howYouWereMade || "",
        businessGiven: existingCoreValue.businessGiven || "",
        desireForCustomers: existingCoreValue.desireForCustomers || "",
        problemsYouSolve: existingCoreValue.problemsYouSolve || "",
        principleAtHeart: existingCoreValue.principleAtHeart || "",
        feelingsGenerated: existingCoreValue.feelingsGenerated || "",
        coreValueDraft1: existingCoreValue.coreValueDraft1 || "",
        coreValueDraft2: existingCoreValue.coreValueDraft2 || "",
        coreValueFinal: existingCoreValue.coreValueFinal || "",
        alignmentScores: (existingCoreValue.alignmentScores as Record<string, number>) || {},
      });
      if (existingCoreValue.aiSuggestions) {
        setAiSuggestions(existingCoreValue.aiSuggestions);
      }
    }
  }, [existingCoreValue]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<FormData>) => {
      const res = await apiRequest("POST", "/api/workbook/core-value", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbook/core-value"] });
      toast({ title: "Progress saved!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      ...formData,
    });
  };

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAlignmentChange = (areaId: string, value: number[]) => {
    setFormData((prev) => ({
      ...prev,
      alignmentScores: {
        ...prev.alignmentScores,
        [areaId]: value[0],
      },
    }));
  };

  const askAICoach = async () => {
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/workbook/ai-coach", {
        section: "core-value",
        action: "suggest_core_values",
        currentAnswers: formData,
        message: aiMessage,
      });
      const data = await res.json();
      if (data.response) {
        setAiSuggestions((prev) => [...prev, data.response]);
      }
      setAiMessage("");
    } catch (error) {
      toast({ title: "AI coach unavailable", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const calculateAlignmentAverage = () => {
    const scores = Object.values(formData.alignmentScores);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
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
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-corevalue-title">
                Find Your Core Value
              </h1>
              <p className="text-muted-foreground text-sm">
                Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-corevalue"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm text-muted-foreground">{Math.round((currentStep / STEPS.length) * 100)}%</span>
          </div>
          <Progress value={(currentStep / STEPS.length) * 100} className="h-2" />
          <div className="flex justify-between mt-2">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`text-xs ${
                  currentStep === step.id
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-muted-foreground"
                }`}
                data-testid={`button-step-${step.id}`}
              >
                {step.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {currentStep === 1 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-blue-500" />
                    Foundation Questions
                  </CardTitle>
                  <CardDescription>
                    Reflect on what shaped you and your business journey
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="howYouWereMade">How were you made for this business?</Label>
                    <Textarea
                      id="howYouWereMade"
                      value={formData.howYouWereMade}
                      onChange={(e) => handleFieldChange("howYouWereMade", e.target.value)}
                      placeholder="What life experiences, skills, or passions led you to start this business?"
                      className="min-h-[120px]"
                      data-testid="input-how-you-were-made"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessGiven">What has this business given you?</Label>
                    <Textarea
                      id="businessGiven"
                      value={formData.businessGiven}
                      onChange={(e) => handleFieldChange("businessGiven", e.target.value)}
                      placeholder="Beyond money - what has running this business provided for you personally?"
                      className="min-h-[120px]"
                      data-testid="input-business-given"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desireForCustomers">What do you desire for your customers?</Label>
                    <Textarea
                      id="desireForCustomers"
                      value={formData.desireForCustomers}
                      onChange={(e) => handleFieldChange("desireForCustomers", e.target.value)}
                      placeholder="What transformation or outcome do you truly want for the people you serve?"
                      className="min-h-[120px]"
                      data-testid="input-desire-for-customers"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {currentStep === 2 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-500" />
                    Reflection Questions
                  </CardTitle>
                  <CardDescription>
                    Dig deeper into the heart of what you do
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="problemsYouSolve">What problems do you really solve?</Label>
                    <Textarea
                      id="problemsYouSolve"
                      value={formData.problemsYouSolve}
                      onChange={(e) => handleFieldChange("problemsYouSolve", e.target.value)}
                      placeholder="Go beyond the surface - what emotional or life problems do you address?"
                      className="min-h-[120px]"
                      data-testid="input-problems-you-solve"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="principleAtHeart">What principle is at the heart of your business?</Label>
                    <Textarea
                      id="principleAtHeart"
                      value={formData.principleAtHeart}
                      onChange={(e) => handleFieldChange("principleAtHeart", e.target.value)}
                      placeholder="If your business was a person, what would it stand for?"
                      className="min-h-[120px]"
                      data-testid="input-principle-at-heart"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feelingsGenerated">What feelings do you want to generate?</Label>
                    <Textarea
                      id="feelingsGenerated"
                      value={formData.feelingsGenerated}
                      onChange={(e) => handleFieldChange("feelingsGenerated", e.target.value)}
                      placeholder="How should customers feel after working with you?"
                      className="min-h-[120px]"
                      data-testid="input-feelings-generated"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {currentStep === 3 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    Draft Your Core Value
                  </CardTitle>
                  <CardDescription>
                    Put your core value into words - try a few versions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="coreValueDraft1">First Draft</Label>
                    <Input
                      id="coreValueDraft1"
                      value={formData.coreValueDraft1}
                      onChange={(e) => handleFieldChange("coreValueDraft1", e.target.value)}
                      placeholder="Try expressing your core value in one sentence..."
                      data-testid="input-core-value-draft-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coreValueDraft2">Second Draft</Label>
                    <Input
                      id="coreValueDraft2"
                      value={formData.coreValueDraft2}
                      onChange={(e) => handleFieldChange("coreValueDraft2", e.target.value)}
                      placeholder="Refine it or try a completely different approach..."
                      data-testid="input-core-value-draft-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coreValueFinal" className="text-lg font-semibold">Final Core Value</Label>
                    <Input
                      id="coreValueFinal"
                      value={formData.coreValueFinal}
                      onChange={(e) => handleFieldChange("coreValueFinal", e.target.value)}
                      placeholder="Your final core value statement..."
                      className="text-lg"
                      data-testid="input-core-value-final"
                    />
                  </div>

                  <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground mb-2">AI Coach Suggestions</h4>
                          {aiSuggestions.length > 0 ? (
                            <div className="space-y-2">
                              {aiSuggestions.map((suggestion, idx) => (
                                <p key={idx} className="text-sm text-muted-foreground bg-white dark:bg-gray-900 p-3 rounded-lg">
                                  {suggestion}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Click below to get AI suggestions based on your answers
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Input
                              placeholder="Ask the AI coach a question..."
                              value={aiMessage}
                              onChange={(e) => setAiMessage(e.target.value)}
                              className="flex-1"
                              data-testid="input-ai-message"
                            />
                            <Button
                              onClick={askAICoach}
                              disabled={aiLoading}
                              size="default"
                              data-testid="button-ask-ai"
                            >
                              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </>
          )}

          {currentStep === 4 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    Alignment Check
                  </CardTitle>
                  <CardDescription>
                    Rate how well each area of your business reflects your core value (1-10)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.coreValueFinal && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-muted-foreground mb-1">Your Core Value:</p>
                      <p className="text-lg font-semibold text-foreground">{formData.coreValueFinal}</p>
                    </div>
                  )}

                  <div className="grid gap-4">
                    {BUSINESS_AREAS.map((area) => {
                      const Icon = area.icon;
                      const score = formData.alignmentScores[area.id] || 5;
                      return (
                        <div key={area.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <Label>{area.label}</Label>
                            </div>
                            <Badge variant="secondary">{score}/10</Badge>
                          </div>
                          <Slider
                            value={[score]}
                            min={1}
                            max={10}
                            step={1}
                            onValueChange={(value) => handleAlignmentChange(area.id, value)}
                            data-testid={`slider-${area.id}`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-foreground">Overall Alignment Score</span>
                        <Badge
                          className={
                            calculateAlignmentAverage() >= 7
                              ? "bg-emerald-500"
                              : calculateAlignmentAverage() >= 5
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }
                        >
                          {calculateAlignmentAverage()}/10
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {calculateAlignmentAverage() >= 7
                          ? "Great alignment! Your business reflects your core value well."
                          : calculateAlignmentAverage() >= 5
                          ? "Good start. Focus on the lower-scoring areas in your planning."
                          : "There's work to do. This workbook will help you align your business with your core value."}
                      </p>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => (currentStep === 1 ? navigate("/workbook") : setCurrentStep(Math.max(1, currentStep - 1)))}
            className="gap-2"
            data-testid="button-previous"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? "Back to Dashboard" : "Previous"}
          </Button>

          {currentStep < 4 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)} className="gap-2" data-testid="button-next">
              Next Step
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                handleSave();
                navigate("/workbook/swot");
              }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-complete-continue"
            >
              Complete & Continue to SWOT
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
