import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Play, Clock, TrendingUp, X, History, ExternalLink, Scissors } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { SearchResult, SearchSegment } from '@shared/schema';
import { Link } from 'wouter';

interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  totalFound: number;
  message?: string;
}

interface SearchQueryHistory {
  id: number;
  query: string;
  totalFound: number;
  createdAt: string;
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SearchResult | null>(null);
  const { toast } = useToast();

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await apiRequest('POST', '/api/search', { query: searchQuery, limit: 10 });
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      setResults(data.results);
      if (data.results.length === 0) {
        toast({
          title: "No results",
          description: "No relevant videos found. Try different keywords.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const { data: searchHistory } = useQuery<SearchQueryHistory[]>({
    queryKey: ['/api/search/history'],
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query.trim());
  };

  const handleHistoryClick = (historicalQuery: string) => {
    setQuery(historicalQuery);
    searchMutation.mutate(historicalQuery);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-slate-100 dark:from-slate-900 dark:via-background dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 mt-8">
          <h1 className="text-5xl font-bold mb-4" data-testid="text-page-title">
            Ask<span className="text-primary">Video</span>
          </h1>
          <p className="text-muted-foreground text-lg" data-testid="text-page-subtitle">
            AI-powered semantic search across your training videos
          </p>
        </div>

        <Card className="mb-8 shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch}>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a question or describe what you're looking for..."
                    className="pl-12 h-14 text-lg"
                    disabled={searchMutation.isPending}
                    data-testid="input-search-query"
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={searchMutation.isPending || !query.trim()}
                  className="px-8"
                  data-testid="button-search"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Search'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {searchHistory && searchHistory.length > 0 && !searchMutation.isPending && results.length === 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5" />
                Recent Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {searchHistory.slice(0, 6).map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleHistoryClick(item.query)}
                    className="text-sm"
                    data-testid={`button-history-${item.id}`}
                  >
                    {item.query}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {item.totalFound}
                    </Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {searchMutation.isPending && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-searching">Analyzing videos with AI...</p>
          </div>
        )}

        {!searchMutation.isPending && results.length > 0 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground" data-testid="text-result-count">
              Found {results.length} relevant video{results.length !== 1 ? 's' : ''}
            </p>

            {results.map((video) => (
              <Card 
                key={video.videoId} 
                className="hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => setSelectedVideo(video)}
                data-testid={`card-result-${video.videoId}`}
              >
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-48 h-32 bg-slate-900 rounded-lg flex-shrink-0 overflow-hidden">
                      {video.thumbnailUrl ? (
                        <img 
                          src={video.thumbnailUrl} 
                          alt={video.videoTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-8 h-8 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-xl font-semibold hover:text-primary" data-testid={`text-video-title-${video.videoId}`}>
                          {video.videoTitle}
                        </h3>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <Badge variant="secondary" data-testid={`badge-relevance-${video.videoId}`}>
                            {video.relevanceScore}% match
                          </Badge>
                        </div>
                      </div>

                      <p className="text-muted-foreground mb-4 line-clamp-2" data-testid={`text-match-summary-${video.videoId}`}>
                        {video.matchSummary}
                      </p>

                      {video.relevantSegments && video.relevantSegments.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Most Relevant Segments:
                          </p>
                          <div className="space-y-1">
                            {video.relevantSegments.slice(0, 3).map((segment: SearchSegment, idx: number) => {
                              const startTime = typeof segment.startTime === 'number' ? segment.startTime : 0;
                              const endTime = typeof segment.endTime === 'number' ? segment.endTime : 0;
                              return (
                                <div 
                                  key={idx}
                                  className="flex items-center justify-between gap-3 text-sm bg-accent/50 rounded-lg p-2"
                                  data-testid={`segment-${video.videoId}-${idx}`}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Badge variant="outline" className="font-mono flex-shrink-0">
                                      {formatTime(startTime)} - {formatTime(endTime)}
                                    </Badge>
                                    <span className="text-muted-foreground truncate">{segment.reason || 'Relevant content'}</span>
                                  </div>
                                  {video.youtubeId && (
                                    <Link 
                                      href={`/videos/${video.videoId}/clips?start=${Math.floor(startTime)}&end=${Math.floor(endTime)}`}
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    >
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="flex-shrink-0"
                                        data-testid={`button-publish-clip-${video.videoId}-${idx}`}
                                      >
                                        <Scissors className="w-3 h-3 mr-1" />
                                        Create Clip
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        <Link href={`/videos/${video.videoId}`}>
                          <Button size="sm" variant="outline" data-testid={`button-view-${video.videoId}`}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </Link>
                        {video.youtubeId && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://youtube.com/watch?v=${video.youtubeId}`, '_blank');
                            }}
                            data-testid={`button-youtube-${video.videoId}`}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Watch on YouTube
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedVideo && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
            onClick={() => setSelectedVideo(null)}
            data-testid="modal-video-preview"
          >
            <Card 
              className="max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle data-testid="modal-video-title">{selectedVideo.videoTitle}</CardTitle>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setSelectedVideo(null)}
                  data-testid="button-close-modal"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {selectedVideo.youtubeId ? (
                  <div className="aspect-video w-full mb-4">
                    <iframe
                      src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}`}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                      title={selectedVideo.videoTitle}
                    />
                  </div>
                ) : selectedVideo.thumbnailUrl ? (
                  <img 
                    src={selectedVideo.thumbnailUrl} 
                    alt={selectedVideo.videoTitle}
                    className="w-full rounded-lg mb-4"
                  />
                ) : null}
                
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold mb-2">Why this video matches your search:</p>
                    <p className="text-muted-foreground">{selectedVideo.matchSummary}</p>
                  </div>
                  
                  {selectedVideo.relevantSegments && selectedVideo.relevantSegments.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Jump to relevant sections:</h4>
                      <div className="space-y-2">
                        {selectedVideo.relevantSegments.map((segment: SearchSegment, idx: number) => {
                          const startTime = typeof segment.startTime === 'number' ? segment.startTime : 0;
                          return (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => {
                                if (selectedVideo.youtubeId) {
                                  window.open(
                                    `https://youtube.com/watch?v=${selectedVideo.youtubeId}&t=${Math.floor(startTime)}s`,
                                    '_blank'
                                  );
                                }
                              }}
                              disabled={!selectedVideo.youtubeId}
                              data-testid={`modal-segment-${idx}`}
                            >
                              <Badge variant="outline" className="mr-2 font-mono">
                                {formatTime(startTime)}
                              </Badge>
                              {segment.reason || 'Relevant content'}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <Link href={`/videos/${selectedVideo.videoId}`}>
                      <Button data-testid="modal-button-view-details">
                        View Full Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
