import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, Sparkles, FileText, Image as ImageIcon, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [captionsFile, setCaptionsFile] = useState(null);
    const [captionsText, setCaptionsText] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [generatingCaptions, setGeneratingCaptions] = useState(false);
    const [generatingMetadata, setGeneratingMetadata] = useState({ title: false, description: false, thumbnail: false });
    const [uploading, setUploading] = useState(false);

    const handleVideoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setVideoFile(file);
            setVideoUrl(file_url);
            toast.success('Video uploaded successfully!');
        } catch (error) {
            toast.error('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleGenerateCaptions = async () => {
        if (!videoUrl) {
            toast.error('Please upload a video first');
            return;
        }

        setGeneratingCaptions(true);
        try {
            // TODO: Replace with your AssemblyAI backend function when enabled
            // Example: const result = await base44.functions.generateCaptions({ video_url: videoUrl });
            
            toast.info('In production, this will call AssemblyAI via your backend function');
            
            // Mock captions for now
            const mockCaptions = `1
00:00:00,000 --> 00:00:05,000
Welcome to this training session on effective leadership.

2
00:00:05,000 --> 00:00:10,000
Today we'll cover key strategies for building high-performing teams.

3
00:00:10,000 --> 00:00:15,000
Let's start with the fundamentals of communication and trust.`;

            setCaptionsText(mockCaptions);
            toast.success('Captions generated! (Mock data for now)');
        } catch (error) {
            toast.error('Caption generation failed: ' + error.message);
        } finally {
            setGeneratingCaptions(false);
        }
    };

    const handleGenerateTitle = async () => {
        if (!videoFile && !title) {
            toast.error('Please upload a video or enter some context');
            return;
        }

        setGeneratingMetadata({ ...generatingMetadata, title: true });
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate a professional, engaging title for a business training video. Context: ${videoFile?.name || title || 'leadership training'}. Make it clear, specific, and under 60 characters.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' }
                    }
                }
            });

            setTitle(result.title);
            toast.success('Title generated!');
        } catch (error) {
            toast.error('Title generation failed: ' + error.message);
        } finally {
            setGeneratingMetadata({ ...generatingMetadata, title: false });
        }
    };

    const handleGenerateDescription = async () => {
        if (!title && !videoFile) {
            toast.error('Please add a title or upload a video first');
            return;
        }

        setGeneratingMetadata({ ...generatingMetadata, description: true });
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate a compelling YouTube video description for a business training video titled "${title || videoFile?.name}". Include:
- Brief overview (2-3 sentences)
- Key takeaways (3-5 bullet points)
- Relevant hashtags (5-7)
Make it professional and engaging.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        description: { type: 'string' }
                    }
                }
            });

            setDescription(result.description);
            toast.success('Description generated!');
        } catch (error) {
            toast.error('Description generation failed: ' + error.message);
        } finally {
            setGeneratingMetadata({ ...generatingMetadata, description: false });
        }
    };

    const handleGenerateThumbnail = async () => {
        if (!title) {
            toast.error('Please add a title first');
            return;
        }

        setGeneratingMetadata({ ...generatingMetadata, thumbnail: true });
        try {
            const result = await base44.integrations.Core.GenerateImage({
                prompt: `Professional YouTube thumbnail for a business training video titled "${title}". Modern, clean design with bold text overlay. Corporate style. High quality, eye-catching.`
            });

            setThumbnailUrl(result.url);
            toast.success('Thumbnail generated!');
        } catch (error) {
            toast.error('Thumbnail generation failed: ' + error.message);
        } finally {
            setGeneratingMetadata({ ...generatingMetadata, thumbnail: false });
        }
    };

    const handleThumbnailUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setThumbnailFile(file);
            setThumbnailUrl(file_url);
            toast.success('Thumbnail uploaded!');
        } catch (error) {
            toast.error('Thumbnail upload failed: ' + error.message);
        }
    };

    const handleCaptionsUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setCaptionsText(event.target.result);
            setCaptionsFile(file);
            toast.success('Captions file loaded!');
        };
        reader.readAsText(file);
    };

    const handlePublish = async () => {
        if (!videoUrl || !title || !description || !captionsText) {
            toast.error('Please complete all required fields (video, title, description, captions)');
            return;
        }

        try {
            // TODO: Replace with your webhook URL when ready
            // This will send all data to your YouTube publishing service
            const webhookUrl = 'YOUR_WEBHOOK_URL_HERE';
            
            const payload = {
                video_url: videoUrl,
                title: title,
                description: description,
                thumbnail_url: thumbnailUrl,
                captions: captionsText,
                timestamp: new Date().toISOString()
            };

            toast.info('In production, this will POST to your webhook with all video data');
            console.log('Would publish:', payload);

            // await fetch(webhookUrl, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(payload)
            // });

            toast.success('Video ready to publish! Connect your webhook to complete the flow.');
            
            // Reset form
            setVideoFile(null);
            setVideoUrl('');
            setTitle('');
            setDescription('');
            setThumbnailUrl('');
            setCaptionsText('');
        } catch (error) {
            toast.error('Publishing failed: ' + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Publish Video to YouTube</h1>
                    <p className="text-gray-600">Upload video, generate captions & metadata, then publish</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left Column - Video & Captions */}
                    <div className="space-y-6">
                        {/* Video Upload */}
                        <Card>
                            <CardHeader>
                                <CardTitle>1. Upload Video</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="video-upload">Select video file from your computer</Label>
                                    <Input
                                        id="video-upload"
                                        type="file"
                                        accept="video/*"
                                        onChange={handleVideoUpload}
                                        disabled={uploading}
                                        className="mt-2"
                                    />
                                </div>
                                {uploading && (
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Uploading video...
                                    </div>
                                )}
                                {videoUrl && (
                                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                        <p className="text-sm text-green-800">✓ Video uploaded successfully</p>
                                        <video 
                                            src={videoUrl} 
                                            controls 
                                            className="w-full mt-3 rounded-lg"
                                            style={{ maxHeight: '300px' }}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Captions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>2. Generate or Upload Captions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleGenerateCaptions}
                                        disabled={!videoUrl || generatingCaptions}
                                        className="flex-1"
                                    >
                                        {generatingCaptions ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 mr-2" />
                                        )}
                                        Generate with AssemblyAI
                                    </Button>
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            accept=".srt,.vtt"
                                            onChange={handleCaptionsUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <Button variant="outline">
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload SRT
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="captions">Captions (SRT format)</Label>
                                    <Textarea
                                        id="captions"
                                        value={captionsText}
                                        onChange={(e) => setCaptionsText(e.target.value)}
                                        placeholder="Captions will appear here..."
                                        className="mt-2 min-h-[200px] font-mono text-sm"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Metadata */}
                    <div className="space-y-6">
                        {/* Title */}
                        <Card>
                            <CardHeader>
                                <CardTitle>3. Video Title</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Input
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Enter video title..."
                                        />
                                    </div>
                                    <Button
                                        onClick={handleGenerateTitle}
                                        disabled={generatingMetadata.title}
                                        variant="outline"
                                    >
                                        {generatingMetadata.title ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Description */}
                        <Card>
                            <CardHeader>
                                <CardTitle>4. Video Description</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Enter video description with hashtags..."
                                        className="min-h-[150px]"
                                    />
                                    <Button
                                        onClick={handleGenerateDescription}
                                        disabled={generatingMetadata.description}
                                        variant="outline"
                                        className="self-end"
                                    >
                                        {generatingMetadata.description ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 mr-2" />
                                        )}
                                        Generate with AI
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Thumbnail */}
                        <Card>
                            <CardHeader>
                                <CardTitle>5. Thumbnail</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleGenerateThumbnail}
                                        disabled={generatingMetadata.thumbnail}
                                        className="flex-1"
                                    >
                                        {generatingMetadata.thumbnail ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 mr-2" />
                                        )}
                                        Generate with AI
                                    </Button>
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <Button variant="outline">
                                            <ImageIcon className="w-4 h-4 mr-2" />
                                            Upload
                                        </Button>
                                    </div>
                                </div>

                                {thumbnailUrl && (
                                    <div className="border rounded-lg overflow-hidden">
                                        <img src={thumbnailUrl} alt="Thumbnail" className="w-full" />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Publish Button */}
                        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                            <CardContent className="pt-6">
                                <Button
                                    onClick={handlePublish}
                                    size="lg"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                                >
                                    <Send className="w-5 h-5 mr-2" />
                                    Approve & Publish to YouTube
                                </Button>
                                <p className="text-xs text-gray-600 mt-3 text-center">
                                    This will send video, captions, title, description, and thumbnail to your webhook
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}