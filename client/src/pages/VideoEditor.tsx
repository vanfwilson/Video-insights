import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  useVideo, 
  useVideoStatus, 
  useUpdateVideo, 
  useGenerateMetadata, 
  useGenerateThumbnail,
  usePublishVideo,
  usePublishInfo,
  useAnalyzeContentStart,
  useAnalyzeContentEnd,
  useSaveTrimTimes
} from "@/hooks/use-videos";
import { useAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Wand2, Youtube, Save, ArrowLeft, Image as ImageIcon, 
  Lock, Globe, EyeOff, CheckCircle2, RefreshCw, Scissors, Sparkles, Clock,
  Shield, AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ConfidentialityCheck } from "@shared/schema";

export default function VideoEditor() {
  const [, params] = useRoute("/videos/:id");
  const id = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const { data: video, isLoading, refetch } = useVideo(id);
  
  // Block search role users from video pages
  const userRole = user?.role;
  const isSearchOnly = userRole === "search";
  
  // Poll status if active
  const isActive = ["uploading", "transcribing", "generating_metadata", "publishing"].includes(video?.status || "");
  useVideoStatus(id, isActive);

  // Auto-refetch when status changes from polling in background
  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => refetch(), 5000);
      return () => clearInterval(interval);
    }
  }, [isActive, refetch]);

  // Mutations
  const updateMutation = useUpdateVideo();
  const generateMetaMutation = useGenerateMetadata();
  const generateThumbMutation = useGenerateThumbnail();
  const publishMutation = usePublishVideo();
  const analyzeContentMutation = useAnalyzeContentStart();
  const analyzeContentEndMutation = useAnalyzeContentEnd();
  const saveTrimMutation = useSaveTrimTimes();
  const queryClient = useQueryClient();
  
  // Confidentiality check
  const { data: confidentialityCheck, refetch: refetchConfCheck } = useQuery<ConfidentialityCheck | null>({
    queryKey: ['/api/videos', id, 'confidentiality-check'],
    queryFn: async () => {
      const res = await fetch(`/api/videos/${id}/confidentiality-check`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id,
  });
  
  const runConfidentialityCheckMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/videos/${id}/confidentiality-check`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos', id, 'confidentiality-check'] });
      queryClient.invalidateQueries({ queryKey: ['/api/videos', id] });
      refetch();
      toast({ title: "Confidentiality check complete", description: "Review the results below." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Check failed", description: err.message || "Could not complete analysis." });
    }
  });
  
  // Check if user is admin/superadmin
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  
  // Trim state (local form state)
  const [trimStartTime, setTrimStartTime] = useState("00:00:00");
  const [trimEndTime, setTrimEndTime] = useState("");
  const [aiStartAnalysis, setAiStartAnalysis] = useState<{ reason: string; confidence: string } | null>(null);
  const [aiEndAnalysis, setAiEndAnalysis] = useState<{ suggestedEndMs: number | null; reason: string; confidence: string; shouldTrim: boolean } | null>(null);
  
  // Helper functions for time conversion
  const msToTimeString = (ms: number | null | undefined): string => {
    if (ms === null || ms === undefined) return "";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const timeStringToMs = (time: string): number | null => {
    if (!time) return null;
    const match = time.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    return hours * 3600000 + minutes * 60000 + seconds * 1000;
  };
  
  // Sync trim times from video data
  useEffect(() => {
    if (video) {
      setTrimStartTime(msToTimeString(video.trimStartMs) || "00:00:00");
      setTrimEndTime(msToTimeString(video.trimEndMs) || "");
    }
  }, [video?.trimStartMs, video?.trimEndMs]);
  
  // Fetch user's publish permissions and channels
  const { data: publishInfo, isLoading: publishInfoLoading } = usePublishInfo();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  
  // Auto-select first channel or default channel when loaded
  useEffect(() => {
    if (publishInfo && !selectedChannelId) {
      if (publishInfo.defaultChannel) {
        setSelectedChannelId(publishInfo.defaultChannel.id);
      } else if (publishInfo.channels.length > 0) {
        setSelectedChannelId(publishInfo.channels[0].id);
      }
    }
  }, [publishInfo, selectedChannelId]);

  // Local state for form
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: "",
    thumbnailPrompt: "",
    speakerImageUrl: "",
    privacyStatus: "private" as "public" | "private" | "unlisted",
  });

  // Sync local state when data loads
  useEffect(() => {
    if (video) {
      setFormData({
        title: video.title || "",
        description: video.description || "",
        tags: video.tags || "",
        thumbnailPrompt: video.thumbnailPrompt || "",
        speakerImageUrl: video.speakerImageUrl || "",
        privacyStatus: (video.privacyStatus as any) || "private",
      });
    }
  }, [video]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }
  
  // Block search role users from video pages
  if (isSearchOnly) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500 mb-4">Your account only has search access. Contact an admin for video editing permissions.</p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Go Home
          </Button>
        </div>
      </div>
    );
  }
  
  if (!video) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Video not found</h2>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({
      id,
      ...formData,
    }, {
      onSuccess: () => {
        toast({ title: "Changes saved", description: "Your video details have been updated." });
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLocation("/")}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <h1 className="font-bold text-lg text-slate-900 truncate max-w-xs sm:max-w-md">
              {formData.title || "Untitled Video"}
            </h1>
            <StatusBadge status={video.status} />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            
            {video.youtubeUrl ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/videos/${id}/clips`)}
                  data-testid="button-clip-studio"
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  Clip Studio
                </Button>
                <a 
                  href={video.youtubeUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
                  data-testid="link-youtube"
                >
                  <Youtube className="w-4 h-4" /> View on YouTube
                </a>
              </div>
            ) : (video.status === 'failed') ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm text-red-600 font-medium">Publish failed</span>
                  {video.errorMessage && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(video.errorMessage || '');
                        toast({ title: "Copied", description: "Error message copied to clipboard" });
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer max-w-xs truncate"
                      title={video.errorMessage}
                      data-testid="button-copy-error"
                    >
                      {video.errorMessage.length > 40 ? video.errorMessage.slice(0, 40) + '...' : video.errorMessage}
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateMutation.mutate({ id, status: 'ready_to_edit' as any, errorMessage: null as any }, {
                    onSuccess: () => {
                      toast({ title: "Status reset", description: "You can try publishing again." });
                      refetch();
                    }
                  })}
                  disabled={updateMutation.isPending}
                  data-testid="button-reset-status"
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Reset
                </Button>
              </div>
            ) : (video.status === 'publishing') ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span className="text-sm text-amber-600 font-medium">Publishing...</span>
              </div>
            ) : publishInfo?.canPublish ? (
              <div className="flex items-center gap-2">
                {publishInfo.showChannelSelector && publishInfo.channels.length > 0 && (
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    data-testid="select-channel"
                    disabled={publishInfoLoading}
                  >
                    {publishInfo.channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                )}
                {!publishInfo.showChannelSelector && publishInfo.defaultChannel && (
                  <span className="text-sm text-slate-500 px-2">
                    Publishing to: <strong>{publishInfo.defaultChannel.name}</strong>
                  </span>
                )}
                <button
                  onClick={() => publishMutation.mutate({ id, channelId: selectedChannelId || undefined }, {
                    onSuccess: () => toast({ title: "Publishing started", description: "Your video is being sent to YouTube." })
                  })}
                  disabled={video.status !== 'ready_to_edit' || publishMutation.isPending || !selectedChannelId}
                  title={!selectedChannelId ? "No channel assigned - ask superadmin" : undefined}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md shadow-primary/20 transition-all"
                  data-testid="button-publish"
                >
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                  Publish
                </button>
              </div>
            ) : (
              <span className="text-sm text-slate-400">No publish access</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Main Edit Area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Metadata Card */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold font-display text-slate-900">Video Details</h2>
              <button
                onClick={() => generateMetaMutation.mutate(id)}
                disabled={generateMetaMutation.isPending || video.status === 'uploading' || video.status === 'transcribing'}
                className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {generateMetaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Regenerate AI Metadata
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Title</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-lg"
                  placeholder="Enter a catchy title..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none"
                  placeholder="What is your video about?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tags</label>
                <input
                  value={formData.tags}
                  onChange={(e) => setFormData(p => ({ ...p, tags: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm font-mono text-slate-600"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
          </section>

          {/* Clip Trimming Card */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Clip Trimming
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    analyzeContentMutation.mutate(id, {
                      onSuccess: (result) => {
                        setTrimStartTime(msToTimeString(result.suggestedStartMs) || "00:00:00");
                        setAiStartAnalysis({ reason: result.reason, confidence: result.confidence });
                        toast({ title: "AI Analysis Complete", description: result.reason });
                      },
                      onError: () => {
                        toast({ variant: "destructive", title: "Analysis Failed", description: "Could not analyze transcript" });
                      }
                    });
                  }}
                  disabled={analyzeContentMutation.isPending || !video.transcript}
                  className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  data-testid="button-analyze-content-start"
                >
                  {analyzeContentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Find Start
                </button>
                <button
                  onClick={() => {
                    analyzeContentEndMutation.mutate(id, {
                      onSuccess: (result) => {
                        if (result.shouldTrim && result.suggestedEndMs) {
                          setTrimEndTime(msToTimeString(result.suggestedEndMs) || "");
                        }
                        setAiEndAnalysis(result);
                        toast({ 
                          title: result.shouldTrim ? "End Point Found" : "No Trim Needed", 
                          description: result.reason 
                        });
                      },
                      onError: () => {
                        toast({ variant: "destructive", title: "Analysis Failed", description: "Could not analyze transcript end" });
                      }
                    });
                  }}
                  disabled={analyzeContentEndMutation.isPending || !video.transcript}
                  className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  data-testid="button-analyze-content-end"
                >
                  {analyzeContentEndMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Find End
                </button>
              </div>
            </div>
            
            {/* AI Start Suggestion Display */}
            {(video.suggestedStartMs !== null && video.suggestedStartMs !== undefined) || aiStartAnalysis ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      Suggested Start: <span className="font-mono text-primary">{msToTimeString(video.suggestedStartMs) || "00:00:00"}</span>
                    </p>
                    {aiStartAnalysis && (
                      <p className="text-xs text-slate-600 mt-1">{aiStartAnalysis.reason}</p>
                    )}
                    <button
                      onClick={() => setTrimStartTime(msToTimeString(video.suggestedStartMs) || "00:00:00")}
                      className="text-xs text-primary hover:underline mt-2"
                      data-testid="button-use-start-suggestion"
                    >
                      Use this start time
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            
            {/* AI End Suggestion Display */}
            {aiEndAnalysis ? (
              <div className={`${aiEndAnalysis.shouldTrim ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} border rounded-xl p-4 mb-4`}>
                <div className="flex items-start gap-3">
                  <Sparkles className={`w-5 h-5 mt-0.5 ${aiEndAnalysis.shouldTrim ? 'text-amber-600' : 'text-green-600'}`} />
                  <div className="flex-1">
                    {aiEndAnalysis.shouldTrim && aiEndAnalysis.suggestedEndMs ? (
                      <>
                        <p className="text-sm font-medium text-slate-900">
                          Suggested End: <span className="font-mono text-amber-700">{msToTimeString(aiEndAnalysis.suggestedEndMs)}</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-1">{aiEndAnalysis.reason}</p>
                        <button
                          onClick={() => setTrimEndTime(msToTimeString(aiEndAnalysis.suggestedEndMs) || "")}
                          className="text-xs text-amber-700 hover:underline mt-2"
                          data-testid="button-use-end-suggestion"
                        >
                          Use this end time
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-green-700">No end trim needed</p>
                        <p className="text-xs text-slate-600 mt-1">{aiEndAnalysis.reason}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Start Time
                </label>
                <input
                  value={trimStartTime}
                  onChange={(e) => setTrimStartTime(e.target.value)}
                  placeholder="00:00:00"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono"
                  data-testid="input-trim-start"
                />
                <p className="text-xs text-slate-500 mt-1">Skip intros, small talk, tech setup</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  End Time
                </label>
                <input
                  value={trimEndTime}
                  onChange={(e) => setTrimEndTime(e.target.value)}
                  placeholder={video.durationMs ? msToTimeString(video.durationMs) : "Leave blank for full"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono"
                  data-testid="input-trim-end"
                />
                <p className="text-xs text-slate-500 mt-1">Cut sales pitches, closing chatter</p>
              </div>
            </div>
            
            {video.durationMs && (
              <p className="text-xs text-slate-500 mb-4">
                Video duration: <span className="font-mono">{msToTimeString(video.durationMs)}</span>
              </p>
            )}
            
            <button
              onClick={() => {
                const startMs = timeStringToMs(trimStartTime);
                const endMs = trimEndTime ? timeStringToMs(trimEndTime) : null;
                
                saveTrimMutation.mutate({ id, trimStartMs: startMs, trimEndMs: endMs }, {
                  onSuccess: () => {
                    toast({ title: "Trim Times Saved", description: "Video will be trimmed when published." });
                    refetch();
                  },
                  onError: (err: any) => {
                    toast({ variant: "destructive", title: "Save Failed", description: err.message });
                  }
                });
              }}
              disabled={saveTrimMutation.isPending}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              data-testid="button-save-trim"
            >
              {saveTrimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Trim Settings
            </button>
          </section>

          {/* Transcript Card */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold font-display text-slate-900 mb-4">Transcript</h2>
            <div className="bg-slate-50 rounded-xl p-4 h-64 overflow-y-auto border border-slate-100 text-sm leading-relaxed text-slate-600">
              <textarea
                value={video.transcript || ""}
                readOnly
                className="w-full h-full p-4 bg-slate-50 text-sm leading-relaxed text-slate-600 resize-none outline-none font-mono"
              />
            </div>
          </section>
        </div>

        {/* Right Column - Thumbnail & Settings */}
        <div className="space-y-8">
          
          {/* Thumbnail Card */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold font-display text-slate-900 mb-4">Thumbnail</h2>
            
            <div className="aspect-video rounded-xl bg-slate-100 overflow-hidden border border-slate-200 mb-4 relative group">
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs font-medium">No Image</span>
                </div>
              )}
              {/* Overlay loader */}
              {generateThumbMutation.isPending && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Image Prompt</label>
              <textarea
                value={formData.thumbnailPrompt}
                onChange={(e) => setFormData(p => ({ ...p, thumbnailPrompt: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary outline-none min-h-[80px] resize-none"
                placeholder="Describe the image you want..."
              />

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => generateThumbMutation.mutate({ id, prompt: formData.thumbnailPrompt }, {
                    onSuccess: () => refetch()
                  })}
                  disabled={generateThumbMutation.isPending || !formData.thumbnailPrompt}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  data-testid="button-generate-thumbnail"
                >
                  <Wand2 className="w-4 h-4" />
                  Generate New
                </button>

                <div className="relative">
                  <input
                    type="file"
                    id="thumbnail-upload"
                    className="hidden"
                    accept="image/*"
                    data-testid="input-thumbnail-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const uploadFormData = new FormData();
                      uploadFormData.append('file', file);

                      try {
                        const res = await fetch(`/api/videos/${id}/upload-thumbnail`, {
                          method: 'POST',
                          body: uploadFormData
                        });
                        if (res.ok) {
                          toast({ title: "Thumbnail uploaded", description: "Your custom thumbnail has been set." });
                          refetch();
                        }
                      } catch (err) {
                        toast({ variant: "destructive", title: "Upload failed", description: "Could not upload thumbnail." });
                      }
                    }}
                  />
                  <label
                    htmlFor="thumbnail-upload"
                    className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer"
                    data-testid="button-upload-thumbnail"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Upload
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    id="speaker-upload"
                    className="hidden"
                    accept="image/*"
                    data-testid="input-speaker-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      // Save reference to current prompt before FormData shadowing
                      const currentPrompt = formData.thumbnailPrompt;

                      const uploadFormData = new FormData();
                      uploadFormData.append('file', file);

                      try {
                        const res = await fetch(`/api/videos/${id}/speaker-image`, {
                          method: 'POST',
                          body: uploadFormData
                        });
                        if (res.ok) {
                          toast({ title: "Image uploaded", description: "Speaker image added successfully." });
                          refetch();
                          // Automatically trigger thumbnail generation
                          generateThumbMutation.mutate({ id, prompt: currentPrompt });
                        }
                      } catch (err) {
                        toast({ variant: "destructive", title: "Upload failed", description: "Could not upload speaker image." });
                      }
                    }}
                  />
                  <label
                    htmlFor="speaker-upload"
                    className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer"
                    data-testid="button-add-speaker"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Add Speaker
                  </label>
                </div>
              </div>

              {video.speakerImageUrl && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                    <img src={video.speakerImageUrl} alt="Speaker" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">Speaker Image Added</p>
                    <p className="text-[10px] text-slate-500 truncate">Will be included in AI generation</p>
                  </div>
                  <button 
                    onClick={() => updateMutation.mutate({ id, speakerImageUrl: null }, { onSuccess: () => refetch() })}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Confidentiality Check */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-slate-700" />
                <h2 className="text-xl font-bold font-display text-slate-900">Confidentiality Check</h2>
              </div>
              {video.confidentialityStatus === "clear" && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Clear
                </Badge>
              )}
              {video.confidentialityStatus === "flagged" && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Review Needed
                </Badge>
              )}
              {video.confidentialityStatus === "checking" && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Checking...
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-slate-500 mb-4">
              Uses AI to scan the transcript for proprietary information, financial details, personal/health data, or company secrets that shouldn&apos;t be published publicly.
            </p>

            <Button
              onClick={() => runConfidentialityCheckMutation.mutate()}
              disabled={runConfidentialityCheckMutation.isPending || !video.transcript || video.confidentialityStatus === "checking"}
              className="w-full"
              variant="outline"
              data-testid="button-confidentiality-check"
            >
              {runConfidentialityCheckMutation.isPending || video.confidentialityStatus === "checking" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Transcript...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Check for Confidential Content
                </>
              )}
            </Button>
            
            {!video.transcript && (
              <p className="text-xs text-slate-400 mt-2 text-center">
                Video must be transcribed first
              </p>
            )}

            {/* Results display */}
            {confidentialityCheck && confidentialityCheck.status === "completed" && (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-sm font-medium text-slate-700">{confidentialityCheck.summary}</p>
                  {((confidentialityCheck.highCount ?? 0) > 0 || (confidentialityCheck.mediumCount ?? 0) > 0 || (confidentialityCheck.lowCount ?? 0) > 0) ? (
                    <div className="flex items-center gap-2 mt-2">
                      {(confidentialityCheck.highCount ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {confidentialityCheck.highCount} High
                        </Badge>
                      )}
                      {(confidentialityCheck.mediumCount ?? 0) > 0 && (
                        <Badge className="bg-amber-100 text-amber-800 text-xs">
                          {confidentialityCheck.mediumCount} Medium
                        </Badge>
                      )}
                      {(confidentialityCheck.lowCount ?? 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {confidentialityCheck.lowCount} Low
                        </Badge>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Flagged Segments */}
                {confidentialityCheck.segments && (confidentialityCheck.segments as any[]).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-800">Flagged Segments</h3>
                    {(confidentialityCheck.segments as any[]).map((seg: any, idx: number) => {
                      const isResolved = seg.resolutionStatus === "resolved";
                      const isIgnored = seg.resolutionStatus === "ignored";
                      const isPending = !seg.resolutionStatus || seg.resolutionStatus === "pending";
                      
                      return (
                        <div 
                          key={seg.id || idx}
                          className={cn(
                            "p-3 rounded-lg border text-sm",
                            isResolved ? "bg-green-50 border-green-200 opacity-60" :
                            isIgnored ? "bg-slate-50 border-slate-200 opacity-60" :
                            seg.severity === "high" ? "bg-red-50 border-red-200" :
                            seg.severity === "medium" ? "bg-amber-50 border-amber-200" :
                            "bg-blue-50 border-blue-200"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={seg.severity === "high" ? "destructive" : "secondary"}
                                className={cn(
                                  "text-xs capitalize",
                                  seg.severity === "medium" && "bg-amber-100 text-amber-800"
                                )}
                              >
                                {seg.severity}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {seg.startTime} - {seg.endTime}
                              </span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {seg.category?.replace("_", " ")}
                              </Badge>
                            </div>
                            {isResolved && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Resolved
                              </Badge>
                            )}
                            {isIgnored && (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs">
                                Ignored
                              </Badge>
                            )}
                          </div>
                          <p className="text-slate-700">{seg.reason}</p>
                          {seg.resolvedAt && (
                            <p className="text-xs text-slate-400 mt-1">
                              {isResolved ? "Resolved" : "Ignored"} on {new Date(seg.resolvedAt).toLocaleDateString()}
                              {seg.resolutionNote && ` - ${seg.resolutionNote}`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Publishing Settings */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold font-display text-slate-900 mb-4">Visibility</h2>
            
            <div className="space-y-3">
              {[
                { value: 'public', icon: Globe, label: 'Public', desc: 'Everyone can see this video' },
                { value: 'unlisted', icon: Lock, label: 'Unlisted', desc: 'Only people with the link' },
                { value: 'private', icon: EyeOff, label: 'Private', desc: 'Only you can see this' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData(p => ({ ...p, privacyStatus: option.value as any }))}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left",
                    formData.privacyStatus === option.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                    formData.privacyStatus === option.value ? "text-primary" : "text-slate-400"
                  )}>
                    {formData.privacyStatus === option.value ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <option.icon className="w-3.5 h-3.5 text-slate-500" />
                      {option.label}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
