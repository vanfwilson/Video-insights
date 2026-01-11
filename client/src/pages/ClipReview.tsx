import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useVideo } from "@/hooks/use-videos";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ArrowLeft, Wand2, Play,
  Clock, Scissors, Youtube, Sparkles, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Video } from "@shared/schema";

interface SuggestedClip {
  startSec: number;
  endSec: number;
  title: string;
  description: string;
  hashtags: string;
  sentiment: string;
  priority: number;
  reason: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function ClipReview() {
  const [, params] = useRoute("/videos/:id/clips");
  const id = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Parse URL query parameters for pre-filling from Ask a Video
  const urlParams = new URLSearchParams(window.location.search);
  const urlStartRaw = urlParams.get("start");
  const urlEndRaw = urlParams.get("end");
  
  // Safely parse and validate URL params - default to 0/60 if invalid
  const parseUrlTime = (val: string | null, fallback: number): number => {
    if (!val) return fallback;
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  
  const initialStart = parseUrlTime(urlStartRaw, 0);
  const initialEnd = parseUrlTime(urlEndRaw, 60);

  const { data: video, isLoading } = useVideo(id);

  const [selectedClip, setSelectedClip] = useState<SuggestedClip | null>(null);
  const [clipForm, setClipForm] = useState({
    startSec: initialStart,
    endSec: initialEnd,
    title: "",
    description: "",
    hashtags: "",
    thumbnailPrompt: "",
  });
  const [previewStart, setPreviewStart] = useState(initialStart);
  const [previewEnd, setPreviewEnd] = useState(initialEnd);
  const [customPrompt, setCustomPrompt] = useState("");

  const { data: existingClips = [], isLoading: clipsLoading } = useQuery<Video[]>({
    queryKey: ["/api/videos", id, "clips"],
    queryFn: async () => {
      const res = await fetch(`/api/videos/${id}/clips`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clips");
      return res.json();
    },
    enabled: !!id,
  });

  const suggestClipsMutation = useMutation({
    mutationFn: async (promptText?: string) => {
      const res = await fetch(`/api/videos/${id}/suggest-clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPrompt: promptText }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to suggest clips");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestedClips(data.clips || []);
      toast({ title: `Found ${data.clips?.length || 0} potential viral clips` });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const [suggestedClips, setSuggestedClips] = useState<SuggestedClip[]>([]);

  const createClipMutation = useMutation({
    mutationFn: async (clipData: typeof clipForm) => {
      const res = await fetch(`/api/videos/${id}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clipData),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create clip");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", id, "clips"] });
      toast({ title: "Clip created! Redirecting to editor..." });
      setLocation(`/videos/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSelectSuggestedClip = (clip: SuggestedClip) => {
    setSelectedClip(clip);
    setClipForm({
      startSec: clip.startSec,
      endSec: clip.endSec,
      title: clip.title,
      description: clip.description,
      hashtags: clip.hashtags,
      thumbnailPrompt: `Thumbnail for viral clip: ${clip.title}`,
    });
    setPreviewStart(clip.startSec);
    setPreviewEnd(clip.endSec);
  };

  useEffect(() => {
    setPreviewStart(clipForm.startSec);
    setPreviewEnd(clipForm.endSec);
  }, [clipForm.startSec, clipForm.endSec]);

  const userRole = user?.role;
  const isSearchOnly = userRole === "search";

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isSearchOnly) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-4">Your account only has search access.</p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Video not found</h2>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!video.youtubeId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Video Not Published</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-4">This video must be published to YouTube before creating clips.</p>
          <Button onClick={() => setLocation(`/videos/${id}`)} data-testid="button-go-editor">
            Go to Editor
          </Button>
        </div>
      </div>
    );
  }

  const sentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "positive": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "negative": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "neutral": return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/videos/${id}`)}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">Clip Studio</h1>
              <p className="text-sm text-muted-foreground truncate max-w-xs">{video.title}</p>
            </div>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Scissors className="w-3 h-3" />
            {existingClips.length} clips
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Youtube className="w-5 h-5 text-red-600" />
                  Video Preview
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {formatTime(previewStart)} - {formatTime(previewEnd)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden">
                  <iframe
                    key={`${video.youtubeId}-${previewStart}-${previewEnd}`}
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${video.youtubeId}?start=${previewStart}&end=${previewEnd}&autoplay=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="border-0"
                    data-testid="youtube-player"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 rounded-md border p-4">
                  {video.transcript ? (
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {video.transcript}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground text-sm">No transcript available</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    AI Suggestions
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => suggestClipsMutation.mutate(customPrompt)}
                    disabled={suggestClipsMutation.isPending}
                    data-testid="button-suggest-clips"
                  >
                    {suggestClipsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Wand2 className="w-4 h-4 mr-1" />
                    )}
                    {suggestedClips.length > 0 ? "Refresh" : "Generate"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customPrompt" className="text-xs text-muted-foreground">
                    Custom guidance for AI (optional)
                  </Label>
                  <Textarea
                    id="customPrompt"
                    placeholder="e.g., Focus on moments about leadership, find clips with strong emotional impact, look for quotable one-liners..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="text-sm resize-none"
                    rows={2}
                    data-testid="input-custom-prompt"
                  />
                </div>
                {suggestedClips.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Click "Generate" to find viral clip opportunities
                  </p>
                ) : (
                  <ScrollArea className="h-72">
                    <div className="space-y-3 pr-2">
                      {suggestedClips.map((clip, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectSuggestedClip(clip)}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all hover-elevate",
                            selectedClip === clip
                              ? "border-primary bg-primary/5"
                              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          )}
                          data-testid={`suggested-clip-${idx}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-medium text-sm line-clamp-1">{clip.title}</h4>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-green-600" />
                              <span className="text-xs font-medium">{clip.priority}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Clock className="w-3 h-3" />
                            {formatTime(clip.startSec)} - {formatTime(clip.endSec)}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge className={cn("text-xs", sentimentColor(clip.sentiment))}>
                              {clip.sentiment}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{clip.reason}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Clip Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="startSec" className="text-xs">Start (sec)</Label>
                    <Input
                      id="startSec"
                      type="number"
                      min={0}
                      value={clipForm.startSec}
                      onChange={(e) => setClipForm({ ...clipForm, startSec: parseInt(e.target.value) || 0 })}
                      data-testid="input-start-sec"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="endSec" className="text-xs">End (sec)</Label>
                    <Input
                      id="endSec"
                      type="number"
                      min={0}
                      value={clipForm.endSec}
                      onChange={(e) => setClipForm({ ...clipForm, endSec: parseInt(e.target.value) || 0 })}
                      data-testid="input-end-sec"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="title" className="text-xs">Title</Label>
                  <Input
                    id="title"
                    value={clipForm.title}
                    onChange={(e) => setClipForm({ ...clipForm, title: e.target.value })}
                    placeholder="Clip title..."
                    data-testid="input-clip-title"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="description" className="text-xs">Description</Label>
                  <Textarea
                    id="description"
                    value={clipForm.description}
                    onChange={(e) => setClipForm({ ...clipForm, description: e.target.value })}
                    placeholder="Clip description..."
                    rows={3}
                    data-testid="input-clip-description"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="hashtags" className="text-xs">Hashtags</Label>
                  <Input
                    id="hashtags"
                    value={clipForm.hashtags}
                    onChange={(e) => setClipForm({ ...clipForm, hashtags: e.target.value })}
                    placeholder="#viral #shorts"
                    data-testid="input-clip-hashtags"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="thumbnailPrompt" className="text-xs">Thumbnail Prompt</Label>
                  <Input
                    id="thumbnailPrompt"
                    value={clipForm.thumbnailPrompt}
                    onChange={(e) => setClipForm({ ...clipForm, thumbnailPrompt: e.target.value })}
                    placeholder="Describe the thumbnail..."
                    data-testid="input-thumbnail-prompt"
                  />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setPreviewStart(clipForm.startSec);
                      setPreviewEnd(clipForm.endSec);
                    }}
                    data-testid="button-preview-clip"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => createClipMutation.mutate(clipForm)}
                    disabled={createClipMutation.isPending || !clipForm.title}
                    data-testid="button-create-clip"
                  >
                    {createClipMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Scissors className="w-4 h-4 mr-1" />
                    )}
                    Create Clip
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {existingClips.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Clip History ({existingClips.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {existingClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="p-4 border rounded-lg hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/videos/${clip.id}`)}
                    data-testid={`clip-card-${clip.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm line-clamp-1">{clip.title || "Untitled Clip"}</h4>
                      <Badge variant={clip.status === "published" ? "default" : "outline"}>
                        {clip.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Clock className="w-3 h-3" />
                      {formatTime(clip.startSec || 0)} - {formatTime(clip.endSec || 0)}
                    </div>
                    {clip.youtubeUrl && (
                      <a
                        href={clip.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Youtube className="w-3 h-3" />
                        View on YouTube
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
