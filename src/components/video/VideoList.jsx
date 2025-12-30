import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function VideoList({ videos, onSelectVideo, onDeleteVideo }) {
    if (videos.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg border">
                <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No videos uploaded yet</p>
                <p className="text-sm text-gray-400 mt-2">Upload your first video to get started</p>
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
                <Card key={video.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                        <div className="aspect-video bg-gray-900 relative overflow-hidden rounded-t-lg">
                            {video.file_url ? (
                                <video 
                                    src={video.file_url} 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Video className="w-12 h-12 text-gray-400" />
                                </div>
                            )}
                            <div className="absolute top-2 right-2">
                                <Badge variant={video.status === 'published' ? 'default' : 'secondary'}>
                                    {video.status || 'draft'}
                                </Badge>
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-semibold mb-2 line-clamp-2">
                                {video.title || 'Untitled Video'}
                            </h3>
                            <p className="text-xs text-gray-500 mb-3">
                                Uploaded {format(new Date(video.created_date), 'MMM d, yyyy')}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => onSelectVideo(video)}
                                    className="flex-1"
                                >
                                    <Eye className="w-4 h-4 mr-1" />
                                    Review
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onDeleteVideo(video.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}