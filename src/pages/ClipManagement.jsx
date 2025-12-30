import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

import ClipSuggestions from '../components/clip/ClipSuggestions';
import ClipEditor from '../components/clip/ClipEditor';
import PublishMetadataGenerator from '../components/video/PublishMetadataGenerator';

export default function ClipManagement() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    // Check if user has creator or admin role
    if (currentUser && currentUser.role !== 'admin' && currentUser.app_role !== 'admin' && currentUser.app_role !== 'creator') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <Card>
                        <CardContent className="p-12 text-center">
                            <p className="text-gray-500 mb-4">You need creator or admin access to manage clips</p>
                            <Button onClick={() => navigate('/ClientSearch')}>
                                Go to Search
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
    const [selectedClip, setSelectedClip] = useState(null);
    const [publishingClip, setPublishingClip] = useState(null);

    // Get video from URL params or navigation state
    const videoId = new URLSearchParams(location.search).get('video_id');
    const video = location.state?.video;

    const { data: videoData } = useQuery({
        queryKey: ['video', videoId],
        queryFn: () => base44.entities.Video.filter({ id: videoId })[0],
        enabled: !!videoId && !video
    });

    const currentVideo = video || videoData;

    const updateClipMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Clip.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clips'] });
            toast.success('Clip updated!');
            setSelectedClip(null);
        }
    });

    const handleClipSave = (updatedClip) => {
        updateClipMutation.mutate({
            id: updatedClip.id,
            data: {
                start_time: updatedClip.start_time,
                end_time: updatedClip.end_time,
                duration: updatedClip.duration,
                status: 'approved'
            }
        });
    };

    const handlePublishClip = (clip) => {
        setPublishingClip(clip);
    };

    if (!currentVideo) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="max-w-7xl mx-auto">
                    <Card>
                        <CardContent className="p-12 text-center">
                            <p className="text-gray-500 mb-4">No video selected</p>
                            <Button onClick={() => navigate('/AdminDashboard')}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Go to Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button onClick={() => navigate('/AdminDashboard')} variant="outline">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{currentVideo.title}</h1>
                        <p className="text-gray-600">Create and manage video clips</p>
                    </div>
                </div>

                {/* Main Content */}
                {publishingClip ? (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Button onClick={() => setPublishingClip(null)} variant="outline">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Clips
                            </Button>
                            <h2 className="text-2xl font-bold">Publishing Clip: {publishingClip.title}</h2>
                        </div>

                        <PublishMetadataGenerator
                            video={{
                                ...currentVideo,
                                title: publishingClip.title,
                                transcript_text: extractClipCaptions(
                                    currentVideo.transcript_text,
                                    publishingClip.start_time,
                                    publishingClip.end_time
                                )
                            }}
                            onMetadataApproved={async (metadata) => {
                                try {
                                    await base44.entities.Clip.update(publishingClip.id, {
                                        title: metadata.title,
                                        description: metadata.description,
                                        hashtags: metadata.hashtags.split('#').filter(h => h.trim()).map(h => h.trim()),
                                        status: 'published',
                                        youtube_clip_url: 'pending' // TODO: Replace with actual YouTube publishing
                                    });

                                    toast.success('Clip published!');
                                    queryClient.invalidateQueries({ queryKey: ['clips'] });
                                    setPublishingClip(null);
                                } catch (error) {
                                    toast.error('Publishing failed: ' + error.message);
                                }
                            }}
                        />
                    </div>
                ) : selectedClip ? (
                    <ClipEditor
                        video={currentVideo}
                        clip={selectedClip}
                        onBack={() => setSelectedClip(null)}
                        onSave={handleClipSave}
                        onPublish={handlePublishClip}
                    />
                ) : (
                    <ClipSuggestions
                        video={currentVideo}
                        onClipSelect={setSelectedClip}
                    />
                )}
            </div>
        </div>
    );
}

// Helper function to extract captions for a specific time range
function extractClipCaptions(transcript, startTime, endTime) {
    if (!transcript) return '';

    const lines = transcript.split('\n');
    let relevantCaptions = [];
    let captureNext = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2}),\d+ --> (\d{2}):(\d{2}):(\d{2}),\d+/);
        if (timeMatch) {
            const startSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
            const endSec = parseInt(timeMatch[4]) * 3600 + parseInt(timeMatch[5]) * 60 + parseInt(timeMatch[6]);
            
            if (startSec >= startTime && endSec <= endTime) {
                relevantCaptions.push(line);
                captureNext = true;
            } else {
                captureNext = false;
            }
        } else if (captureNext && line && !line.match(/^\d+$/)) {
            relevantCaptions.push(line);
        }
    }

    return relevantCaptions.join('\n');
}