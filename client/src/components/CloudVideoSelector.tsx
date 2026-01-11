import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Cloud, Search, FileVideo, FolderOpen, Check, X } from "lucide-react";
import { format } from "date-fns";

interface CloudVideo {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: string;
}

interface CloudVideoSelectorProps {
  onProcessStart?: () => void;
}

export function CloudVideoSelector({ onProcessStart }: CloudVideoSelectorProps) {
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  const { data: connection, isLoading: connectionLoading } = useQuery<any>({
    queryKey: ['/api/cloud-connections'],
    select: (connections: any[]) => connections?.find(c => c.provider === 'dropbox' && c.isActive === 'true')
  });
  
  const { data: videos, isLoading: videosLoading, refetch } = useQuery<CloudVideo[]>({
    queryKey: ['/api/dropbox/search-videos'],
    enabled: !!connection,
  });
  
  const createIngestMutation = useMutation({
    mutationFn: async (videoData: CloudVideo[]) => {
      const res = await apiRequest('POST', '/api/ingest-requests', { videos: videoData, provider: 'dropbox' });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Videos queued for processing",
        description: `${selectedVideos.size} video(s) added to the processing queue.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ingest-requests'] });
      setSelectedVideos(new Set());
      onProcessStart?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to queue videos",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSelectAll = () => {
    if (!videos) return;
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(v => v.id)));
    }
  };
  
  const handleToggleVideo = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };
  
  const handleProcess = () => {
    if (!videos || selectedVideos.size === 0) return;
    const selectedVideoData = videos.filter(v => selectedVideos.has(v.id));
    createIngestMutation.mutate(selectedVideoData);
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };
  
  if (connectionLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Checking cloud connection...</p>
      </div>
    );
  }
  
  if (!connection) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Cloud className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No Cloud Storage Connected</h3>
        <p className="text-muted-foreground mb-4">
          Connect your Dropbox account to import videos from the cloud.
        </p>
        <Button variant="outline" asChild>
          <a href="/cloud-storage" data-testid="link-connect-storage">Connect Storage</a>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Folder: <span className="font-medium text-foreground">{connection.selectedFolderName || 'Root'}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={videosLoading}
            data-testid="button-refresh-videos"
          >
            {videosLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-2">Scan for Videos</span>
          </Button>
        </div>
      </div>
      
      {videosLoading && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Searching for video files...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment for large folders</p>
        </div>
      )}
      
      {!videosLoading && videos && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <FileVideo className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Videos Found</h3>
          <p className="text-muted-foreground">
            No video files were found in the selected folder.
          </p>
        </div>
      )}
      
      {!videosLoading && videos && videos.length > 0 && (
        <>
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedVideos.size === videos.length}
                onCheckedChange={handleSelectAll}
                data-testid="checkbox-select-all"
              />
              <span className="text-sm font-medium">
                {selectedVideos.size === 0 
                  ? `Select all (${videos.length} videos)`
                  : `${selectedVideos.size} of ${videos.length} selected`}
              </span>
            </div>
            <Button
              onClick={handleProcess}
              disabled={selectedVideos.size === 0 || createIngestMutation.isPending}
              data-testid="button-process-videos"
            >
              {createIngestMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Process Selected ({selectedVideos.size})
            </Button>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {videos.map((video) => (
              <Card
                key={video.id}
                className={`p-3 cursor-pointer transition-colors hover-elevate ${
                  selectedVideos.has(video.id) ? 'bg-primary/5 border-primary/30' : ''
                }`}
                onClick={() => handleToggleVideo(video.id)}
                data-testid={`card-video-${video.id}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedVideos.has(video.id)}
                    onCheckedChange={() => handleToggleVideo(video.id)}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`checkbox-video-${video.id}`}
                  />
                  <FileVideo className="w-8 h-8 text-primary/70 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" title={video.name}>{video.name}</p>
                    <p className="text-xs text-muted-foreground truncate" title={video.path}>{video.path}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {formatFileSize(video.size)}
                    </Badge>
                    {video.modified && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(video.modified), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
