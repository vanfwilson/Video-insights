import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
    pending: { icon: Clock, color: 'bg-gray-100 text-gray-800', label: 'Pending' },
    processing: { icon: Play, color: 'bg-blue-100 text-blue-800', label: 'Processing' },
    needs_review: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-800', label: 'Needs Review' },
    approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Approved' },
    published: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-800', label: 'Published' }
};

export default function ProcessingQueue({ videos, onProcessVideo, onReviewVideo }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Processing Queue</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {videos.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No videos in queue</p>
                    ) : (
                        videos.map((video) => {
                            const status = statusConfig[video.status] || statusConfig.pending;
                            const StatusIcon = status.icon;

                            return (
                                <div key={video.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium truncate">{video.title}</h4>
                                                <Badge className={status.color}>
                                                    <StatusIcon className="w-3 h-3 mr-1" />
                                                    {status.label}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                Added {format(new Date(video.created_date), 'MMM d, yyyy h:mm a')}
                                            </p>
                                            {video.topics && video.topics.length > 0 && (
                                                <div className="flex gap-1 mt-2 flex-wrap">
                                                    {video.topics.map((topic, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-xs">
                                                            {topic}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            {video.status === 'processing' && (
                                                <Progress value={65} className="mt-2 h-2" />
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {video.status === 'pending' && (
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => onProcessVideo(video)}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    <Play className="w-4 h-4 mr-1" />
                                                    Process
                                                </Button>
                                            )}
                                            {(video.status === 'needs_review' || video.status === 'approved') && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => onReviewVideo(video)}
                                                >
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    Review
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}