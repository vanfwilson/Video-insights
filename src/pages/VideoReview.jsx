import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';

import TranscriptViewer from '../components/video/TranscriptViewer';
import ConfidentialityReview from '../components/video/ConfidentialityReview';
import ClipTimeline from '../components/clip/ClipTimeline';
import ClipMetadataEditor from '../components/clip/ClipMetadataEditor';
import ControlledYouTubePlayer from '../components/clip/ControlledYouTubePlayer';

export default function VideoReview() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    const [editingClip, setEditingClip] = useState(null);

    const { data: video, isLoading } = useQuery({
        queryKey: ['video', videoId],
        queryFn: () => base44.entities.Video.filter({ id: videoId }).then(videos => videos[0]),
        enabled: !!videoId
    });

    const { data: clips = [] } = useQuery({
        queryKey: ['clips', videoId],
        queryFn: () => base44.entities.Clip.filter({ video_id: videoId }),
        enabled: !!videoId
    });

    const updateVideoMutation = useMutation({
        mutationFn: (data) => base44.entities.Video.update(videoId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['video', videoId] });
            toast.success('Video updated successfully');
        }
    });

    const updateClipMutation = useMutation({
        mutationFn: ({ clipId, data }) => base44.entities.Clip.update(clipId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clips', videoId] });
            toast.success('Clip updated');
            setEditingClip(null);
        }
    });

    const approveClipMutation = useMutation({
        mutationFn: (clip) => base44.entities.Clip.update(clip.id, { status: 'approved' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clips', videoId] });
            toast.success('Clip approved');
        }
    });

    const deleteClipMutation = useMutation({
        mutationFn: (clipId) => base44.entities.Clip.delete(clipId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clips', videoId] });
            toast.success('Clip deleted');
        }
    });

    const approveVideoMutation = useMutation({
        mutationFn: () => base44.entities.Video.update(videoId, { status: 'approved' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['video', videoId] });
            toast.success('Video approved! Ready for clip publishing.');
            navigate(createPageUrl('AdminDashboard'));
        }
    });

    if (isLoading || !video) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading video...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(createPageUrl('AdminDashboard'))}
                        className="mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{video.title}</h1>
                    <p className="text-gray-600">Review transcript, clips, and confidentiality</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-6">
                        {video.youtube_video_id && (
                            <ControlledYouTubePlayer
                                videoId={video.youtube_video_id}
                                startTime={0}
                                endTime={300}
                                title="Full Video Preview"
                            />
                        )}
                        
                        <ConfidentialityReview
                            video={video}
                            onUpdate={(data) => updateVideoMutation.mutate(data)}
                        />
                    </div>

                    <TranscriptViewer
                        transcript={video.transcript_text}
                        onSave={(transcript) => updateVideoMutation.mutate({ transcript_text: transcript })}
                    />
                </div>

                {editingClip ? (
                    <ClipMetadataEditor
                        clip={editingClip}
                        onSave={(metadata) => updateClipMutation.mutate({
                            clipId: editingClip.id,
                            data: metadata
                        })}
                        onCancel={() => setEditingClip(null)}
                    />
                ) : (
                    <ClipTimeline
                        clips={clips}
                        onEditClip={setEditingClip}
                        onDeleteClip={(clipId) => deleteClipMutation.mutate(clipId)}
                        onApproveClip={(clip) => approveClipMutation.mutate(clip)}
                    />
                )}

                <div className="mt-6 flex justify-end">
                    <Button
                        size="lg"
                        onClick={() => approveVideoMutation.mutate()}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Approve Video & Clips
                    </Button>
                </div>
            </div>
        </div>
    );
}