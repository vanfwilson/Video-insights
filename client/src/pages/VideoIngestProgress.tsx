import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileVideo, Loader2, Clock, Download, CheckCircle, XCircle, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface IngestRequest {
  id: number;
  userId: string;
  provider: string;
  sourcePath: string;
  sourceFileName: string;
  sourceFileSize: number | null;
  status: 'queued' | 'downloading' | 'processing' | 'transcribing' | 'ready' | 'failed' | 'cancelled';
  progress: any;
  errorMessage: string | null;
  videoId: number | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  queued: { label: 'Queued', icon: Clock, color: 'bg-slate-100 text-slate-700' },
  downloading: { label: 'Downloading', icon: Download, color: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Processing', icon: Loader2, color: 'bg-amber-100 text-amber-700' },
  transcribing: { label: 'Transcribing', icon: Loader2, color: 'bg-purple-100 text-purple-700' },
  ready: { label: 'Complete', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-slate-100 text-slate-500' },
};

export default function VideoIngestProgress() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const { data: requests, isLoading, refetch } = useQuery<IngestRequest[]>({
    queryKey: ['/api/ingest-requests'],
    refetchInterval: 5000,
  });
  
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/ingest-requests/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Request cancelled" });
      queryClient.invalidateQueries({ queryKey: ['/api/ingest-requests'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to cancel", description: error.message, variant: "destructive" });
    },
  });
  
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };
  
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }
  
  const activeRequests = requests?.filter(r => ['queued', 'downloading', 'processing', 'transcribing'].includes(r.status)) || [];
  const completedRequests = requests?.filter(r => ['ready', 'failed', 'cancelled'].includes(r.status)) || [];
  
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </Link>
            <h1 className="text-xl font-bold text-slate-900">Import Progress</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-progress"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {requests?.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border">
            <FileVideo className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Import Requests</h2>
            <p className="text-slate-500 mb-6">You haven't imported any videos from cloud storage yet.</p>
            <Button asChild>
              <Link href="/upload" data-testid="link-start-import">Start Importing</Link>
            </Button>
          </div>
        ) : (
          <>
            {activeRequests.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  In Progress ({activeRequests.length})
                </h2>
                <div className="space-y-3">
                  {activeRequests.map((request) => {
                    const config = statusConfig[request.status];
                    const StatusIcon = config.icon;
                    return (
                      <Card key={request.id} className="p-4" data-testid={`card-ingest-${request.id}`}>
                        <div className="flex items-center gap-4">
                          <FileVideo className="w-10 h-10 text-primary/60 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{request.sourceFileName}</p>
                            <p className="text-xs text-muted-foreground truncate">{request.sourcePath}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {request.sourceFileSize && (
                              <span className="text-sm text-muted-foreground">
                                {formatFileSize(request.sourceFileSize)}
                              </span>
                            )}
                            <Badge className={config.color}>
                              <StatusIcon className={`w-3 h-3 mr-1 ${request.status === 'downloading' || request.status === 'processing' || request.status === 'transcribing' ? 'animate-spin' : ''}`} />
                              {config.label}
                            </Badge>
                            {request.status === 'queued' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelMutation.mutate(request.id)}
                                disabled={cancelMutation.isPending}
                                data-testid={`button-cancel-${request.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
            
            {completedRequests.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  Completed ({completedRequests.length})
                </h2>
                <div className="space-y-3">
                  {completedRequests.map((request) => {
                    const config = statusConfig[request.status];
                    const StatusIcon = config.icon;
                    return (
                      <Card key={request.id} className="p-4 opacity-75" data-testid={`card-ingest-${request.id}`}>
                        <div className="flex items-center gap-4">
                          <FileVideo className="w-10 h-10 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{request.sourceFileName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{request.sourcePath}</span>
                              {request.completedAt && (
                                <span>- {format(new Date(request.completedAt), 'MMM d, h:mm a')}</span>
                              )}
                            </div>
                            {request.errorMessage && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {request.errorMessage}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Badge className={config.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                            {request.status === 'ready' && request.videoId && (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/videos/${request.videoId}`} data-testid={`link-video-${request.videoId}`}>
                                  View
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
