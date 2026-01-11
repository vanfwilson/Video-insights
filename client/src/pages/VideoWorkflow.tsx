import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Video, Upload, FileText, Send, Loader2, Play,
  AlertTriangle, CheckCircle, Clock, Search, Trash2, Scissors
} from "lucide-react";
import type { Video as VideoType } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  uploading: { label: "Uploading", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Upload },
  transcribing: { label: "Transcribing", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  ready_to_edit: { label: "Ready to Edit", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: FileText },
  generating_metadata: { label: "Generating", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Loader2 },
  publishing: { label: "Publishing", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Loader2 },
  published: { label: "Published", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: CheckCircle },
  failed: { label: "Failed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertTriangle },
};

export default function VideoWorkflow() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  const { data: allVideos = [], isLoading: videosLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/admin/all-videos"],
    enabled: isAdmin,
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: number) => {
      return apiRequest("DELETE", `/api/videos/${videoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-videos"] });
      toast({ title: "Video deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete video", variant: "destructive" });
    },
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allVideos.length,
      uploading: 0,
      transcribing: 0,
      ready_to_edit: 0,
      generating_metadata: 0,
      published: 0,
      failed: 0,
    };
    allVideos.forEach(v => {
      const status = v.status || "ready_to_edit";
      if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
  }, [allVideos]);

  const filteredVideos = useMemo(() => {
    let filtered = allVideos;
    
    if (activeTab !== "all") {
      filtered = filtered.filter(v => v.status === activeTab);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.title?.toLowerCase().includes(q) || 
        v.originalFilename?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q)
      );
    }
    
    return filtered;
  }, [allVideos, activeTab, searchQuery]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Admin Access Required</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">You need admin privileges to access the video workflow dashboard.</p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">Video Workflow</h1>
              <p className="text-sm text-muted-foreground">Manage all videos across the platform</p>
            </div>
          </div>
          <Link href="/upload">
            <Button data-testid="button-upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Video
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { key: "all", label: "All Videos" },
            { key: "uploading", label: "Uploading" },
            { key: "transcribing", label: "Transcribing" },
            { key: "ready_to_edit", label: "Ready to Edit" },
            { key: "generating_metadata", label: "Generating" },
            { key: "published", label: "Published" },
            { key: "failed", label: "Failed" },
          ].map(({ key, label }) => {
            const config = STATUS_CONFIG[key] || { label, color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200", icon: Video };
            const Icon = config.icon;
            return (
              <Card 
                key={key}
                className={`cursor-pointer hover:shadow-lg transition-all ${activeTab === key ? "ring-2 ring-primary" : ""}`}
                onClick={() => setActiveTab(key)}
                data-testid={`card-status-${key}`}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{statusCounts[key] || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    {key !== "all" && <Icon className="w-3 h-3" />}
                    {label}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search videos by title, filename, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-videos"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex-wrap gap-1">
            <TabsTrigger value="all" data-testid="tab-all">
              <Video className="w-4 h-4 mr-2" />
              All ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger value="ready_to_edit" data-testid="tab-ready-to-edit">
              <FileText className="w-4 h-4 mr-2" />
              Ready to Edit ({statusCounts.ready_to_edit})
            </TabsTrigger>
            <TabsTrigger value="published" data-testid="tab-published">
              <CheckCircle className="w-4 h-4 mr-2" />
              Published ({statusCounts.published})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {videosLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredVideos.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No videos found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? "Try adjusting your search query" : "No videos in this category yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVideos.map((video) => {
                  const statusConfig = STATUS_CONFIG[video.status || "ready_to_edit"] || STATUS_CONFIG.ready_to_edit;
                  const StatusIcon = statusConfig.icon;
                  const isClip = !!video.parentVideoId;
                  return (
                    <Card key={video.id} className="hover:shadow-lg transition-shadow" data-testid={`card-video-${video.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative">
                          {video.thumbnailUrl ? (
                            <img 
                              src={video.thumbnailUrl} 
                              alt={video.title || "Video thumbnail"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-8 h-8 text-slate-400" />
                            </div>
                          )}
                          {video.youtubeId && (
                            <a 
                              href={`https://youtube.com/watch?v=${video.youtubeId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute bottom-2 right-2 bg-red-600 text-white p-1.5 rounded-lg"
                            >
                              <Play className="w-4 h-4" />
                            </a>
                          )}
                          {isClip && (
                            <div className="absolute top-2 left-2">
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Scissors className="w-3 h-3" />
                                Clip
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="font-semibold line-clamp-1" data-testid={`text-video-title-${video.id}`}>
                            {video.title || video.originalFilename || "Untitled"}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {video.description || "No description"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          <div className="flex gap-1">
                            <Link href={`/videos/${video.id}`}>
                              <Button size="sm" variant="outline" data-testid={`button-edit-${video.id}`}>
                                Edit
                              </Button>
                            </Link>
                            {video.status === "published" && video.youtubeId && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link href={`/videos/${video.id}/clips`}>
                                    <Button size="sm" variant="outline" data-testid={`button-clips-${video.id}`}>
                                      <Scissors className="w-3 h-3 mr-1" />
                                      Clips
                                    </Button>
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border shadow-md">
                                  Create clips from this video
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => deleteVideoMutation.mutate(video.id)}
                              disabled={deleteVideoMutation.isPending}
                              data-testid={`button-delete-${video.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
