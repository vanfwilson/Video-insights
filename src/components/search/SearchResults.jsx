import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Clock } from 'lucide-react';

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
};

export default function SearchResults({ results, onSelectClip }) {
    if (results.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">No results found. Try a different search query.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((clip) => (
                <Card key={clip.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                        <div className="aspect-video bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                            <Play className="w-12 h-12 text-gray-400" />
                        </div>
                        
                        <h3 className="font-semibold mb-2 line-clamp-2">{clip.title}</h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{clip.description}</p>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(clip.duration)}</span>
                        </div>

                        {clip.topics && clip.topics.length > 0 && (
                            <div className="flex gap-1 flex-wrap mb-3">
                                {clip.topics.slice(0, 3).map((topic, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                        {topic}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => onSelectClip(clip)}
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Watch Clip
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}