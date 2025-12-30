import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scissors, Edit, Trash2, CheckCircle } from 'lucide-react';

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const topicColors = {
    'Human Relations': 'bg-blue-100 text-blue-800',
    'Leadership': 'bg-purple-100 text-purple-800',
    'Communication': 'bg-green-100 text-green-800',
    'Management': 'bg-orange-100 text-orange-800',
    'Training': 'bg-pink-100 text-pink-800'
};

export default function ClipTimeline({ clips, onEditClip, onDeleteClip, onApproveClip }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Scissors className="w-5 h-5" />
                    Suggested Clips ({clips.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {clips.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No clips suggested yet</p>
                    ) : (
                        clips.map((clip) => (
                            <div key={clip.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-medium">{clip.title}</h4>
                                            <Badge variant={clip.status === 'approved' ? 'default' : 'secondary'}>
                                                {clip.status}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{clip.description}</p>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                            <span className="font-mono">
                                                {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                                            </span>
                                            <span>•</span>
                                            <span>{Math.round(clip.duration / 60)} min clip</span>
                                            {clip.confidence_score && (
                                                <>
                                                    <span>•</span>
                                                    <span>{Math.round(clip.confidence_score * 100)}% confidence</span>
                                                </>
                                            )}
                                        </div>
                                        {clip.topics && clip.topics.length > 0 && (
                                            <div className="flex gap-1 flex-wrap">
                                                {clip.topics.map((topic, idx) => (
                                                    <Badge 
                                                        key={idx} 
                                                        variant="outline" 
                                                        className={topicColors[topic] || 'bg-gray-100 text-gray-800'}
                                                    >
                                                        {topic}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {clip.status === 'suggested' && (
                                            <Button 
                                                size="sm" 
                                                onClick={() => onApproveClip(clip)}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                <CheckCircle className="w-4 h-4 mr-1" />
                                                Approve
                                            </Button>
                                        )}
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={() => onEditClip(clip)}
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={() => onDeleteClip(clip.id)}
                                        >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}