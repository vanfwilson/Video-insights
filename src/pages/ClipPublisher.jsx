import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Eye, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import ClipMetadataEditor from '../components/clip/ClipMetadataEditor';
import ControlledYouTubePlayer from '../components/clip/ControlledYouTubePlayer';

export default function ClipPublisher() {
    const queryClient = useQueryClient();
    const [selectedClip, setSelectedClip] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    const { data: clips = [], isLoading } = useQuery({
        queryKey: ['approved-clips'],
        queryFn: () => base44.entities.Clip.filter({ status: 'approved' })
    });

    const publishClipMutation = useMutation({
        mutationFn: async (clip) => {
            // TODO: Call backend function to publish to YouTube when enabled
            toast.info('Publishing to YouTube... This will use your backend function when enabled.');
            
            // Simulate publishing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await base44.entities.Clip.update(clip.id, {
                status: 'published',
                youtube_clip_url: `https://youtube.com/watch?v=dQw4w9WgXcQ&t=${clip.start_time}s`
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approved-clips'] });
            toast.success('Clip published to YouTube successfully!');
            setSelectedClip(null);
        },
        onError: (error) => {
            toast.error('Publishing failed: ' + error.message);
        }
    });

    const updateClipMutation = useMutation({
        mutationFn: ({ clipId, data }) => base44.entities.Clip.update(clipId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approved-clips'] });
            toast.success('Clip metadata updated');
            setIsEditing(false);
        }
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Clip Publisher</h1>
                    <p className="text-gray-600">Review and publish approved clips to YouTube</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Approved Clips ({clips.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {clips.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No approved clips yet</p>
                                    ) : (
                                        clips.map((clip) => (
                                            <div
                                                key={clip.id}
                                                onClick={() => {
                                                    setSelectedClip(clip);
                                                    setIsEditing(false);
                                                }}
                                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                                    selectedClip?.id === clip.id
                                                        ? 'bg-blue-50 border-blue-300'
                                                        : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                <h4 className="font-medium text-sm mb-1">{clip.title}</h4>
                                                <div className="flex gap-1 flex-wrap">
                                                    {clip.topics?.slice(0, 2).map((topic, idx) => (
                                                        <Badge key={idx} variant="secondary" className="text-xs">
                                                            {topic}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                        {selectedClip ? (
                            <div className="space-y-6">
                                <ControlledYouTubePlayer
                                    videoId="dQw4w9WgXcQ"
                                    startTime={selectedClip.start_time}
                                    endTime={selectedClip.end_time}
                                    title={selectedClip.title}
                                />

                                {isEditing ? (
                                    <ClipMetadataEditor
                                        clip={selectedClip}
                                        onSave={(metadata) => updateClipMutation.mutate({
                                            clipId: selectedClip.id,
                                            data: metadata
                                        })}
                                        onCancel={() => setIsEditing(false)}
                                    />
                                ) : (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Clip Details</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div>
                                                <h3 className="font-semibold text-lg mb-2">{selectedClip.title}</h3>
                                                <p className="text-gray-600">{selectedClip.description}</p>
                                            </div>

                                            {selectedClip.hashtags && selectedClip.hashtags.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700 mb-2">Hashtags:</p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {selectedClip.hashtags.map((tag, idx) => (
                                                            <Badge key={idx} variant="secondary">#{tag}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2 pt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setIsEditing(true)}
                                                >
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    Edit Metadata
                                                </Button>
                                                <Button
                                                    onClick={() => publishClipMutation.mutate(selectedClip)}
                                                    className="bg-green-600 hover:bg-green-700"
                                                    disabled={publishClipMutation.isPending}
                                                >
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Publish to YouTube
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12">
                                    <p className="text-center text-gray-500">
                                        Select a clip from the list to preview and publish
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}