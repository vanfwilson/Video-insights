import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { SwotAnalysis } from "@shared/schema";
import {
  Grid3X3,
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Building2,
  Target,
  Users,
  DollarSign,
  MapPin,
  Cpu,
  Package,
} from "lucide-react";

const BUSINESS_AREAS = [
  { id: "overall", label: "Overall Business", icon: Building2, description: "Quick overview of your whole business" },
  { id: "products_services", label: "Products & Services", icon: Package, description: "What you sell and deliver" },
  { id: "marketing", label: "Marketing", icon: Target, description: "How you attract customers" },
  { id: "sales", label: "Sales", icon: Users, description: "How you convert leads to customers" },
  { id: "operations", label: "Operations", icon: Building2, description: "How you deliver your services" },
  { id: "finance", label: "Finance", icon: DollarSign, description: "Cash flow, margins, profitability" },
  { id: "territory", label: "Territory", icon: MapPin, description: "Geographic reach and market area" },
  { id: "people", label: "People", icon: Users, description: "Team, culture, hiring" },
  { id: "tech", label: "Tech", icon: Cpu, description: "Systems, software, equipment" },
];

const SWOT_CATEGORIES = [
  { id: "strengths", label: "Strengths", icon: TrendingUp, color: "bg-blue-500", lightColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200 dark:border-blue-800" },
  { id: "weaknesses", label: "Weaknesses", icon: TrendingDown, color: "bg-red-500", lightColor: "bg-red-50 dark:bg-red-950/30", borderColor: "border-red-200 dark:border-red-800" },
  { id: "opportunities", label: "Opportunities", icon: Shield, color: "bg-emerald-500", lightColor: "bg-emerald-50 dark:bg-emerald-950/30", borderColor: "border-emerald-200 dark:border-emerald-800" },
  { id: "threats", label: "Threats", icon: AlertTriangle, color: "bg-amber-500", lightColor: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-200 dark:border-amber-800" },
];

interface SwotItem {
  text: string;
  priority: number;
}

interface SwotData {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
  keyInsight: string;
}

export default function WorkbookSWOT() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeArea, setActiveArea] = useState("overall");
  const [swotDataByArea, setSwotDataByArea] = useState<Record<string, SwotData>>({});
  const [newItems, setNewItems] = useState<Record<string, string>>({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: "",
  });

  const { data: existingSwots, isLoading } = useQuery<SwotAnalysis[]>({
    queryKey: ["/api/workbook/swot/all"],
    enabled: !!user,
  });

  useEffect(() => {
    if (existingSwots && existingSwots.length > 0) {
      const dataByArea: Record<string, SwotData> = {};
      for (const swot of existingSwots) {
        const area = swot.businessArea || "overall";
        dataByArea[area] = {
          strengths: (swot.strengths as SwotItem[]) || [],
          weaknesses: (swot.weaknesses as SwotItem[]) || [],
          opportunities: (swot.opportunities as SwotItem[]) || [],
          threats: (swot.threats as SwotItem[]) || [],
          keyInsight: swot.keyInsight || "",
        };
      }
      setSwotDataByArea(dataByArea);
    }
  }, [existingSwots]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentData = swotDataByArea[activeArea] || {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: [],
        keyInsight: "",
      };
      const res = await apiRequest("POST", "/api/workbook/swot", {
        businessArea: activeArea,
        strengths: currentData.strengths,
        weaknesses: currentData.weaknesses,
        opportunities: currentData.opportunities,
        threats: currentData.threats,
        keyInsight: currentData.keyInsight,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbook/swot/all"] });
      toast({ title: "SWOT analysis saved!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const getCurrentData = (): SwotData => {
    return swotDataByArea[activeArea] || {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
      keyInsight: "",
    };
  };

  const addItem = (category: keyof SwotData) => {
    if (category === "keyInsight") return;
    const text = newItems[category as string];
    if (!text?.trim()) return;

    const currentData = getCurrentData();
    const items = currentData[category] as SwotItem[];
    const newItem: SwotItem = { text: text.trim(), priority: items.length + 1 };

    setSwotDataByArea((prev) => ({
      ...prev,
      [activeArea]: {
        ...currentData,
        [category]: [...items, newItem],
      },
    }));
    setNewItems((prev) => ({ ...prev, [category]: "" }));
  };

  const removeItem = (category: keyof SwotData, index: number) => {
    if (category === "keyInsight") return;
    const currentData = getCurrentData();
    const items = currentData[category] as SwotItem[];

    setSwotDataByArea((prev) => ({
      ...prev,
      [activeArea]: {
        ...currentData,
        [category]: items.filter((_, i) => i !== index),
      },
    }));
  };

  const updateKeyInsight = (value: string) => {
    const currentData = getCurrentData();
    setSwotDataByArea((prev) => ({
      ...prev,
      [activeArea]: {
        ...currentData,
        keyInsight: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const currentData = getCurrentData();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Grid3X3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-swot-title">
                SWOT Analysis
              </h1>
              <p className="text-muted-foreground text-sm">
                Evaluate each area of your business
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-swot"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>

        <Tabs value={activeArea} onValueChange={setActiveArea} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {BUSINESS_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <TabsTrigger
                  key={area.id}
                  value={area.id}
                  className="gap-2 data-[state=active]:bg-background"
                  data-testid={`tab-${area.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{area.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {BUSINESS_AREAS.map((area) => (
            <TabsContent key={area.id} value={area.id} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SWOT_CATEGORIES.map((category) => {
                  const CategoryIcon = category.icon;
                  const items = (currentData[category.id as keyof SwotData] as SwotItem[]) || [];

                  return (
                    <Card key={category.id} className={`${category.lightColor} ${category.borderColor} border-2`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className={`w-8 h-8 rounded-lg ${category.color} flex items-center justify-center`}>
                            <CategoryIcon className="w-4 h-4 text-white" />
                          </div>
                          {category.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 bg-background rounded-lg p-2 border">
                            <Input
                              value={item.text}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[idx] = { ...item, text: e.target.value };
                                setSwotDataByArea((prev) => ({
                                  ...prev,
                                  [activeArea]: {
                                    ...currentData,
                                    [category.id]: newItems,
                                  },
                                }));
                              }}
                              className="flex-1 border-0 bg-transparent focus-visible:ring-0"
                              data-testid={`input-${category.id}-${idx}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(category.id as keyof SwotData, idx)}
                              className="text-muted-foreground hover:text-destructive flex-shrink-0"
                              data-testid={`button-remove-${category.id}-${idx}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}

                        <div className="flex gap-2">
                          <Input
                            placeholder={`Add ${category.label.toLowerCase()}...`}
                            value={newItems[category.id] || ""}
                            onChange={(e) =>
                              setNewItems((prev) => ({ ...prev, [category.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addItem(category.id as keyof SwotData);
                            }}
                            className="flex-1"
                            data-testid={`input-new-${category.id}`}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => addItem(category.id as keyof SwotData)}
                            data-testid={`button-add-${category.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Key Insight from {area.label}</CardTitle>
                  <CardDescription>
                    What's the most important takeaway from this area's SWOT?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={currentData.keyInsight}
                    onChange={(e) => updateKeyInsight(e.target.value)}
                    placeholder="The biggest priority or pattern I see in this area is..."
                    className="min-h-[100px]"
                    data-testid="input-key-insight"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => navigate("/workbook/core-value")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Core Value
          </Button>

          <Button
            onClick={() => {
              handleSave();
              navigate("/workbook/root-cause");
            }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            data-testid="button-continue"
          >
            Continue to Root Cause
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
