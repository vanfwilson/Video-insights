import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Play, Save, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function ClipEditor({ video, clip, onBack, onSave, onPublish }) {
    const [startTime, setStartTime] = useState(clip.start_time);
    const [endTime, setEndTime] = useState(clip.end_time);
    const [captionText, setCaptionText] = useState('');

    useEffect(() => {
        updateCaptionText(startTime, endTime);
    }, [startTime, endTime, video]);

    const updateCaptionText = (start, end) => {
        if (!video?.transcript_text) return;

        // Parse SRT format to extract captions within time range
        const lines = video.transcript_text.split('\n');
        let relevantCaptions = [];
        let currentTime = null;
        let currentText = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Match timestamp line (e.g., "00:01:30,000 --> 00:01:35,000")
            const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2}),\d+ --> (\d{2}):(\d{2}):(\d{2}),\d+/);
            if (timeMatch) {
                const startSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
                const endSec = parseInt(timeMatch[4]) * 3600 + parseInt(timeMatch[5]) * 60 + parseInt(timeMatch[6]);
                
                if (startSec >= start && endSec <= end) {
                    currentTime = line;
                }
            } else if (currentTime && line && !line.match(/^\d+$/)) {
                // This is caption text
                relevantCaptions.push(`${currentTime}\n${line}`);
                currentTime = null;
            }
        }

        setCaptionText(relevantCaptions.join('\n\n'));
    };

    const handleTimeChange = (type, value) => {
        const newTime = parseFloat(value);
        if (isNaN(newTime)) return;

        if (type === 'start') {
            if (newTime < endTime) {
                setStartTime(newTime);
            } else {
                toast.error('Start time must be before end time');
            }
        } else {
            if (newTime > startTime) {
                setEndTime(newTime);
            } else {
                toast.error('End time must be after start time');
            }
        }
    };

    const handleSave = () => {
        onSave({
            ...clip,
            start_time: startTime,
            end_time: endTime,
            duration: endTime - startTime
        });
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getYouTubeClipUrl = () => {
        if (!video?.youtube_url) return null;
        const videoId = video.youtube_video_id || video.youtube_url.split('v=')[1];
        return `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startTime)}&end=${Math.floor(endTime)}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button onClick={onBack} variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Clips
                </Button>
                <h2 className="text-2xl font-bold flex-1">{clip.title}</h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Left Column - Video Player & Controls */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Preview Clip</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {video?.youtube_url ? (
                                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={getYouTubeClipUrl()}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            ) : video?.file_url ? (
                                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                    <video 
                                        src={`${video.file_url}#t=${startTime},${endTime}`}
                                        controls 
                                        className="w-full h-full"
                                    />
                                </div>
                            ) : (
                                <Alert>
                                    <AlertDescription>Video not available for preview</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-3">
                                <div>
                                    <Label htmlFor="start-time">Start Time (seconds)</Label>
                                    <Input
                                        id="start-time"
                                        type="number"
                                        value={startTime}
                                        onChange={(e) => handleTimeChange('start', e.target.value)}
                                        step="0.1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{formatTime(startTime)}</p>
                                </div>

                                <div>
                                    <Label htmlFor="end-time">End Time (seconds)</Label>
                                    <Input
                                        id="end-time"
                                        type="number"
                                        value={endTime}
                                        onChange={(e) => handleTimeChange('end', e.target.value)}
                                        step="0.1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{formatTime(endTime)}</p>
                                </div>

                                <Alert>
                                    <AlertDescription>
                                        Duration: {Math.round(endTime - startTime)} seconds
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-2">
                        <Button onClick={handleSave} className="flex-1">
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </Button>
                        <Button onClick={() => onPublish(clip)} className="flex-1 bg-green-600 hover:bg-green-700">
                            <Send className="w-4 h-4 mr-2" />
                            Publish Clip
                        </Button>
                    </div>
                </div>

                {/* Right Column - Captions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Clip Captions</CardTitle>
                        <p className="text-sm text-gray-600">
                            Captions for the selected time range (read-only)
                        </p>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={captionText}
                            readOnly
                            className="min-h-[500px] font-mono text-sm bg-gray-50"
                            placeholder="Adjust start/end times to see captions..."
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}