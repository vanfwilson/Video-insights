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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { TimeAudit } from "@shared/schema";
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";

interface Task {
  task: string;
  hours: number;
  dollarValue: number;
  rating: "high" | "medium" | "low";
  delegateTo: string;
}

interface FormData {
  ownerRate: number;
  tasks: Task[];
  hoursToReclaim: number;
  whatToDoWithTime: string;
  timeManagementRating: number;
  biggestTimeWasters: string[];
}

export default function WorkbookTimeAudit() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    ownerRate: 150,
    tasks: [],
    hoursToReclaim: 0,
    whatToDoWithTime: "",
    timeManagementRating: 3,
    biggestTimeWasters: [],
  });

  const [newTask, setNewTask] = useState({
    task: "",
    hours: "",
    rating: "medium" as "high" | "medium" | "low",
    delegateTo: "",
  });

  const { data: existingData, isLoading } = useQuery<TimeAudit | null>({
    queryKey: ["/api/workbook/time-audit"],
    enabled: !!user,
  });

  useEffect(() => {
    if (existingData) {
      setFormData({
        ownerRate: existingData.ownerRate || 150,
        tasks: (existingData.tasks as Task[]) || [],
        hoursToReclaim: existingData.hoursToReclaim || 0,
        whatToDoWithTime: existingData.whatToDoWithTime || "",
        timeManagementRating: existingData.timeManagementRating || 3,
        biggestTimeWasters: existingData.biggestTimeWasters || [],
      });
    }
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<FormData>) => {
      const tasks = data.tasks || [];
      const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);
      const highValueHours = tasks.filter((t) => t.rating === "high").reduce((sum, t) => sum + t.hours, 0);
      const mediumValueHours = tasks.filter((t) => t.rating === "medium").reduce((sum, t) => sum + t.hours, 0);
      const lowValueHours = tasks.filter((t) => t.rating === "low").reduce((sum, t) => sum + t.hours, 0);

      const res = await apiRequest("POST", "/api/workbook/time-audit", {
        ...data,
        totalHoursLogged: totalHours,
        highValueHours,
        mediumValueHours,
        lowValueHours,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbook/time-audit"] });
      toast({ title: "Time audit saved!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const calculateTaskValue = (rating: "high" | "medium" | "low"): number => {
    switch (rating) {
      case "high":
        return formData.ownerRate;
      case "medium":
        return formData.ownerRate * 0.5;
      case "low":
        return formData.ownerRate * 0.2;
    }
  };

  const addTask = () => {
    if (!newTask.task.trim() || !newTask.hours) {
      toast({ title: "Please enter task name and hours", variant: "destructive" });
      return;
    }

    const task: Task = {
      task: newTask.task,
      hours: parseFloat(newTask.hours),
      dollarValue: calculateTaskValue(newTask.rating),
      rating: newTask.rating,
      delegateTo: newTask.delegateTo,
    };

    setFormData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, task],
    }));

    setNewTask({
      task: "",
      hours: "",
      rating: "medium",
      delegateTo: "",
    });
  };

  const removeTask = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  };

  const getTotals = () => {
    const totalHours = formData.tasks.reduce((sum, t) => sum + t.hours, 0);
    const highHours = formData.tasks.filter((t) => t.rating === "high").reduce((sum, t) => sum + t.hours, 0);
    const mediumHours = formData.tasks.filter((t) => t.rating === "medium").reduce((sum, t) => sum + t.hours, 0);
    const lowHours = formData.tasks.filter((t) => t.rating === "low").reduce((sum, t) => sum + t.hours, 0);
    const totalValue = formData.tasks.reduce((sum, t) => sum + t.dollarValue * t.hours, 0);
    return { totalHours, highHours, mediumHours, lowHours, totalValue };
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

  const totals = getTotals();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-timeaudit-title">
                Time Audit
              </h1>
              <p className="text-muted-foreground text-sm">
                Analyze where your time goes and reclaim hours
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-timeaudit"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                Your Hourly Rate
              </CardTitle>
              <CardDescription>
                What's your time worth? This helps calculate task values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="ownerRate" className="whitespace-nowrap">$/hour</Label>
                <Input
                  id="ownerRate"
                  type="number"
                  value={formData.ownerRate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, ownerRate: parseInt(e.target.value) || 0 }))
                  }
                  className="max-w-[120px]"
                  data-testid="input-owner-rate"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Weekly Tasks
              </CardTitle>
              <CardDescription>
                Log your typical weekly tasks and rate their value
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.tasks.map((task, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg"
                >
                  <span className="flex-1 min-w-[150px] font-medium">{task.task}</span>
                  <Badge variant="outline">{task.hours}h</Badge>
                  <Badge
                    className={
                      task.rating === "high"
                        ? "bg-emerald-500"
                        : task.rating === "medium"
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }
                  >
                    ${task.dollarValue}/h
                  </Badge>
                  {task.delegateTo && (
                    <Badge variant="secondary" className="gap-1">
                      <Users className="w-3 h-3" />
                      {task.delegateTo}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTask(idx)}
                    className="text-muted-foreground hover:text-destructive"
                    data-testid={`button-remove-task-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-4 border-t">
                <Input
                  placeholder="Task name"
                  value={newTask.task}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, task: e.target.value }))}
                  className="md:col-span-2"
                  data-testid="input-new-task"
                />
                <Input
                  type="number"
                  placeholder="Hours"
                  value={newTask.hours}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, hours: e.target.value }))}
                  data-testid="input-new-hours"
                />
                <Select
                  value={newTask.rating}
                  onValueChange={(value) =>
                    setNewTask((prev) => ({ ...prev, rating: value as "high" | "medium" | "low" }))
                  }
                >
                  <SelectTrigger data-testid="select-rating">
                    <SelectValue placeholder="Value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High Value</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low Value</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addTask} className="gap-2" data-testid="button-add-task">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-foreground">{totals.totalHours}h</p>
                <p className="text-sm text-muted-foreground">Total Hours</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totals.highHours}h</p>
                <p className="text-sm text-muted-foreground">High Value</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totals.mediumHours}h</p>
                <p className="text-sm text-muted-foreground">Medium Value</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totals.lowHours}h</p>
                <p className="text-sm text-muted-foreground">Low Value</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Time Recovery Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hoursToReclaim">Hours to reclaim per week</Label>
                <Input
                  id="hoursToReclaim"
                  type="number"
                  value={formData.hoursToReclaim}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, hoursToReclaim: parseInt(e.target.value) || 0 }))
                  }
                  className="max-w-[120px]"
                  data-testid="input-hours-to-reclaim"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatToDoWithTime">What will you do with reclaimed time?</Label>
                <Textarea
                  id="whatToDoWithTime"
                  value={formData.whatToDoWithTime}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, whatToDoWithTime: e.target.value }))
                  }
                  placeholder="High-value activities you'll focus on..."
                  className="min-h-[100px]"
                  data-testid="input-what-to-do"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => navigate("/workbook/root-cause")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Root Cause
          </Button>

          <Button
            onClick={() => {
              handleSave();
              navigate("/workbook/action-plan");
            }}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
            data-testid="button-continue"
          >
            Continue to Action Plan
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
