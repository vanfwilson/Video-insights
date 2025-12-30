import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Scissors, Loader2, CheckCircle, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ClipSuggestions({ video, onClipSelect }) {
    const [generating, setGenerating] = useState(false);
    const [clips, setClips] = useState([]);

    useEffect(() => {
        if (video?.transcript_text && clips.length === 0) {
            generateClips();
        }
    }, [video]);

    const generateClips = async () => {
        if (!video?.transcript_text) {
            toast.error('No captions available');
            return;
        }

        setGenerating(true);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze these video captions and identify 5-8 engaging clips for YouTube Shorts/social media. Each clip should be 30-90 seconds and cover a complete thought or topic.

CAPTIONS WITH TIMESTAMPS:
${video.transcript_text}

For each clip, provide:
- start_time: Start time in seconds
- end_time: End time in seconds
- title: Engaging title for the clip (under 60 chars)
- description: Brief description
- topics: Array of relevant topics covered
- confidence_score: How strong this clip is (0-1)

Return 5-8 clips that would work well as standalone content.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        clips: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    start_time: { type: 'number' },
                                    end_time: { type: 'number' },
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    topics: { type: 'array', items: { type: 'string' } },
                                    confidence_score: { type: 'number' }
                                }
                            }
                        }
                    }
                }
            });

            // Save clips to database
            const savedClips = await Promise.all(
                result.clips.map(clip => 
                    base44.entities.Clip.create({
                        video_id: video.id,
                        title: clip.title,
                        description: clip.description,
                        start_time: clip.start_time,
                        end_time: clip.end_time,
                        duration: clip.end_time - clip.start_time,
                        topics: clip.topics,
                        confidence_score: clip.confidence_score,
                        status: 'suggested'
                    })
                )
            );

            setClips(savedClips);
            toast.success(`Generated ${savedClips.length} clip suggestions!`);
        } catch (error) {
            toast.error('Clip generation failed: ' + error.message);
        } finally {
            setGenerating(false);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getConfidenceColor = (score) => {
        if (score >= 0.8) return 'bg-green-100 text-green-800';
        if (score >= 0.6) return 'bg-blue-100 text-blue-800';
        return 'bg-gray-100 text-gray-800';
    };

    if (generating) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Analyzing Video for Clips</h3>
                    <p className="text-gray-600">Using AI to identify engaging segments...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Suggested Clips</h2>
                <Button onClick={generateClips} variant="outline">
                    <Scissors className="w-4 h-4 mr-2" />
                    Regenerate Clips
                </Button>
            </div>

            {clips.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Scissors className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No clips generated yet</p>
                        <Button onClick={generateClips} className="mt-4">
                            Generate Clips
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {clips.map((clip) => (
                        <Card key={clip.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-base line-clamp-2">{clip.title}</CardTitle>
                                    <Badge className={getConfidenceColor(clip.confidence_score)}>
                                        {Math.round(clip.confidence_score * 100)}%
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-gray-600 line-clamp-2">{clip.description}</p>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span className="font-mono">
                                        {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                                    </span>
                                    <span>•</span>
                                    <span>{Math.round(clip.duration)} seconds</span>
                                </div>

                                {clip.topics && clip.topics.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                        {clip.topics.map((topic, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">
                                                {topic}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    onClick={() => onClipSelect(clip)}
                                    className="w-full"
                                    variant={clip.status === 'approved' ? 'outline' : 'default'}
                                >
                                    {clip.status === 'approved' ? (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Approved
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="w-4 h-4 mr-2" />
                                            Review & Edit
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}