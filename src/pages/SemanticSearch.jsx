import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Play, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function SemanticSearch() {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearching(true);
        try {
            const response = await base44.functions.invoke('semanticSearch', { 
                query: query.trim(),
                limit: 10
            });

            if (response.data.success) {
                setResults(response.data.results);
                if (response.data.results.length === 0) {
                    toast.info('No relevant videos found. Try different keywords.');
                }
            } else {
                toast.error('Search failed: ' + response.data.error);
            }
        } catch (error) {
            toast.error('Search failed: ' + error.message);
        } finally {
            setSearching(false);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Google-like Search Header */}
                <div className="text-center mb-12 mt-12">
                    <h1 className="text-5xl font-bold text-gray-900 mb-4">
                        Video<span className="text-blue-600">Search</span>
                    </h1>
                    <p className="text-gray-600 text-lg">AI-powered semantic search for training videos</p>
                </div>

                {/* Search Box */}
                <Card className="mb-8 shadow-lg">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearch}>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Ask a question or describe what you're looking for..."
                                        className="pl-12 h-14 text-lg"
                                        disabled={searching}
                                    />
                                </div>
                                <Button 
                                    type="submit" 
                                    size="lg" 
                                    disabled={searching || !query.trim()}
                                    className="px-8"
                                >
                                    {searching ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Search'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Search Results */}
                {searching && (
                    <div className="text-center py-12">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Analyzing videos with AI...</p>
                    </div>
                )}

                {!searching && results.length > 0 && (
                    <div className="space-y-6">
                        <p className="text-sm text-gray-600">
                            Found {results.length} relevant video{results.length !== 1 ? 's' : ''}
                        </p>

                        {results.map((video) => (
                            <Card 
                                key={video.id} 
                                className="hover:shadow-xl transition-shadow cursor-pointer"
                                onClick={() => setSelectedVideo(video)}
                            >
                                <CardContent className="p-6">
                                    <div className="flex gap-4">
                                        {/* Thumbnail */}
                                        <div className="w-48 h-32 bg-gray-900 rounded-lg flex-shrink-0 overflow-hidden">
                                            {video.thumbnail_url ? (
                                                <img 
                                                    src={video.thumbnail_url} 
                                                    alt={video.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : video.file_url ? (
                                                <video 
                                                    src={video.file_url}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Play className="w-8 h-8 text-gray-400" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="text-xl font-semibold text-gray-900 hover:text-blue-600">
                                                    {video.title}
                                                </h3>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <TrendingUp className="w-4 h-4 text-green-600" />
                                                    <Badge variant="secondary">
                                                        {video.relevance_score}% match
                                                    </Badge>
                                                </div>
                                            </div>

                                            <p className="text-gray-600 mb-4 line-clamp-2">
                                                {video.match_summary}
                                            </p>

                                            {/* Relevant Segments */}
                                            {video.relevant_segments && video.relevant_segments.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                                        <Clock className="w-4 h-4" />
                                                        Most Relevant Segments:
                                                    </p>
                                                    <div className="space-y-1">
                                                        {video.relevant_segments.slice(0, 3).map((segment, idx) => (
                                                            <div 
                                                                key={idx}
                                                                className="flex items-center gap-3 text-sm bg-blue-50 rounded-lg p-2 hover:bg-blue-100"
                                                            >
                                                                <Badge variant="outline" className="font-mono">
                                                                    {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                                                                </Badge>
                                                                <span className="text-gray-700">{segment.reason}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Video Player Modal */}
                {selectedVideo && (
                    <div 
                        className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
                        onClick={() => setSelectedVideo(null)}
                    >
                        <Card 
                            className="max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <CardHeader>
                                <CardTitle>{selectedVideo.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {selectedVideo.file_url && (
                                    <video 
                                        src={selectedVideo.file_url}
                                        controls
                                        autoPlay
                                        className="w-full rounded-lg"
                                    />
                                )}
                                <div className="mt-4">
                                    <p className="text-gray-700 mb-4">{selectedVideo.match_summary}</p>
                                    {selectedVideo.relevant_segments && (
                                        <div>
                                            <h4 className="font-semibold mb-2">Jump to relevant sections:</h4>
                                            <div className="space-y-2">
                                                {selectedVideo.relevant_segments.map((segment, idx) => (
                                                    <Button
                                                        key={idx}
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full justify-start"
                                                        onClick={() => {
                                                            const video = document.querySelector('video');
                                                            if (video) video.currentTime = segment.start_time;
                                                        }}
                                                    >
                                                        {formatTime(segment.start_time)} - {segment.reason}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}