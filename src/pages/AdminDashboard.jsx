import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, Sparkles, FileText, Image as ImageIcon, Send, Video, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import VideoList from '../components/video/VideoList';
import ConfidentialityChecker from '../components/video/ConfidentialityChecker';
import PublishMetadataGenerator from '../components/video/PublishMetadataGenerator';
import GoogleDrivePicker from '../components/video/GoogleDrivePicker';

export default function AdminDashboard() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('videos');

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    // Check if user has admin role
    if (currentUser && currentUser.role !== 'admin' && currentUser.app_role !== 'admin') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <Card>
                        <CardContent className="p-12 text-center">
                            <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
                            <p className="text-gray-600 mb-4">
                                You need admin privileges to access this dashboard
                            </p>
                            <Button onClick={() => navigate(createPageUrl('ClientSearch'))}>
                                Go to Search
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [captionsFile, setCaptionsFile] = useState(null);
    const [captionsText, setCaptionsText] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [youtubeVisibility, setYoutubeVisibility] = useState('unlisted');
    const [confidentialityResults, setConfidentialityResults] = useState(null);
    const [generatingCaptions, setGeneratingCaptions] = useState(false);
    const [generatingMetadata, setGeneratingMetadata] = useState({ title: false, description: false, thumbnail: false });
    const [uploading, setUploading] = useState(false);

    const { data: videos = [] } = useQuery({
        queryKey: ['videos'],
        queryFn: () => base44.entities.Video.list('-created_date', 100)
    });

    const deleteVideoMutation = useMutation({
        mutationFn: (videoId) => base44.entities.Video.delete(videoId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            toast.success('Video deleted');
        }
    });

    const handleVideoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            // Create video entity in database
            const video = await base44.entities.Video.create({
                title: file.name.replace(/\.[^/.]+$/, ''),
                file_url: file_url,
                status: 'draft'
            });
            
            setVideoFile(file);
            setVideoUrl(file_url);
            setSelectedVideo(video);
            setTitle(video.title);
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            toast.success('Video uploaded to Base44 storage!');
        } catch (error) {
            toast.error('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSelectVideo = (video) => {
        setSelectedVideo(video);
        setVideoUrl(video.file_url || '');
        setTitle(video.title || '');
        setDescription(video.description || '');
        setThumbnailUrl(video.thumbnail_url || '');
        setCaptionsText(video.transcript_text || '');
        setYoutubeVisibility(video.youtube_visibility || 'unlisted');
    };

    const handleGenerateCaptions = async () => {
        if (!videoUrl) {
            toast.error('Please upload a video first');
            return;
        }

        setGeneratingCaptions(true);
        try {
            toast.info('Generating captions with AssemblyAI...');
            
            const response = await base44.functions.invoke('generateCaptions', {
                video_url: videoUrl
            });

            if (response.data.success) {
                setCaptionsText(response.data.captions);
                toast.success('Captions generated successfully!');
            } else {
                throw new Error(response.data.error || 'Caption generation failed');
            }
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

        if (confidentialityResults?.risk_level === 'high') {
            const confirm = window.confirm('High confidentiality risk detected. Are you sure you want to publish?');
            if (!confirm) return;
        }

        try {
            // Update video entity
            if (selectedVideo) {
                await base44.entities.Video.update(selectedVideo.id, {
                    title,
                    description,
                    transcript_text: captionsText,
                    thumbnail_url: thumbnailUrl,
                    youtube_visibility: youtubeVisibility,
                    confidentiality_notes: confidentialityResults?.recommendation || '',
                    status: 'ready_to_publish'
                });
            }

            // TODO: Replace with your webhook URL when ready
            const webhookUrl = 'YOUR_WEBHOOK_URL_HERE';
            
            const payload = {
                video_url: videoUrl,
                title: title,
                description: description,
                thumbnail_url: thumbnailUrl,
                captions: captionsText,
                visibility: youtubeVisibility,
                confidentiality_check: confidentialityResults,
                timestamp: new Date().toISOString()
            };

            toast.info('In production, this will POST to your webhook with all video data');
            console.log('Would publish:', payload);

            // await fetch(webhookUrl, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(payload)
            // });

            toast.success('Video approved and ready to publish!');
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            
            // Reset form
            setSelectedVideo(null);
            setVideoFile(null);
            setVideoUrl('');
            setTitle('');
            setDescription('');
            setThumbnailUrl('');
            setCaptionsText('');
            setYoutubeVisibility('unlisted');
            setConfidentialityResults(null);
        } catch (error) {
            toast.error('Publishing failed: ' + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
                    <p className="text-gray-600">Manage and publish videos to YouTube</p>
                </div>

                {/* Status Filter Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { status: 'draft', label: 'For Security Review', count: videos.filter(v => v.status === 'draft').length },
                        { status: 'ready_to_publish', label: 'Ready to Publish', count: videos.filter(v => v.status === 'ready_to_publish').length },
                        { status: 'published', label: 'Published', count: videos.filter(v => v.status === 'published').length },
                        { status: 'all', label: 'All Videos', count: videos.length }
                    ].map(({ status, label, count }) => (
                        <Card 
                            key={status}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                        >
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-gray-900">{count}</div>
                                <div className="text-sm text-gray-600 mt-1">{label}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="videos">
                            <Video className="w-4 h-4 mr-2" />
                            All Videos
                        </TabsTrigger>
                        <TabsTrigger value="upload">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Raw Video
                        </TabsTrigger>
                        <TabsTrigger value="review">
                            <FileText className="w-4 h-4 mr-2" />
                            Review & Approve
                        </TabsTrigger>
                        <TabsTrigger value="publish">
                            <Send className="w-4 h-4 mr-2" />
                            Publish to YouTube
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="videos">
                        <VideoList
                            videos={videos}
                            onSelectVideo={(video) => {
                                handleSelectVideo(video);
                                setActiveTab('review');
                            }}
                            onDeleteVideo={(id) => deleteVideoMutation.mutate(id)}
                        />
                    </TabsContent>

                    <TabsContent value="upload">
                        <div className="grid lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Upload from Computer</CardTitle>
                                    <p className="text-sm text-gray-600">Upload video files from your local device</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="video-upload">Select video file(s) from your computer</Label>
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
                                            Uploading video to Base44 storage...
                                        </div>
                                    )}
                                    {videoUrl && (
                                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                            <p className="text-sm text-green-800">✓ Video uploaded to Base44 storage</p>
                                            <p className="text-xs text-gray-600 mt-1">Go to "All Videos" tab to review it</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <GoogleDrivePicker 
                                onFilesUploaded={(videos) => {
                                    queryClient.invalidateQueries({ queryKey: ['videos'] });
                                    setActiveTab('videos');
                                }}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="review">
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

                        {/* YouTube Visibility */}
                        <Card>
                            <CardHeader>
                                <CardTitle>5. YouTube Visibility</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Select value={youtubeVisibility} onValueChange={setYoutubeVisibility}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="public">Public - Anyone can find and watch</SelectItem>
                                        <SelectItem value="unlisted">Unlisted - Only people with link can watch</SelectItem>
                                        <SelectItem value="private">Private - Only you can watch</SelectItem>
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>

                        {/* Confidentiality Checker */}
                        <ConfidentialityChecker
                            captionsText={captionsText}
                            onResultsUpdate={setConfidentialityResults}
                        />

                        {/* Thumbnail */}
                        <Card>
                            <CardHeader>
                                <CardTitle>6. Thumbnail</CardTitle>
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
                                    className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                                >
                                    <Send className="w-5 h-5 mr-2" />
                                    Approve Video (Ready to Publish)
                                </Button>
                                <p className="text-xs text-gray-600 mt-3 text-center">
                                    This marks the video as ready for publishing after confidentiality review
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="publish">
                        <div className="max-w-4xl mx-auto">
                            {!selectedVideo ? (
                                <Card>
                                    <CardContent className="p-12 text-center">
                                        <Send className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold mb-2">Select a Video to Publish</h3>
                                        <p className="text-gray-600 mb-4">
                                            Choose a video from "All Videos" with status "Ready to Publish"
                                        </p>
                                        <Button onClick={() => setActiveTab('videos')}>
                                            Go to All Videos
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : selectedVideo.status !== 'ready_to_publish' ? (
                                <Card>
                                    <CardContent className="p-12 text-center">
                                        <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold mb-2">Video Not Ready</h3>
                                        <p className="text-gray-600 mb-4">
                                            This video needs to be reviewed and approved first
                                        </p>
                                        <Button onClick={() => setActiveTab('review')}>
                                            Go to Review & Approve
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Publishing: {selectedVideo.title}</CardTitle>
                                            <p className="text-sm text-gray-600">
                                                AI will generate YouTube-compliant metadata from your captions
                                            </p>
                                        </CardHeader>
                                        <CardContent>
                                            {selectedVideo.file_url && (
                                                <video 
                                                    src={selectedVideo.file_url} 
                                                    controls 
                                                    className="w-full rounded-lg"
                                                    style={{ maxHeight: '400px' }}
                                                />
                                            )}
                                        </CardContent>
                                    </Card>

                                    <PublishMetadataGenerator
                                        video={selectedVideo}
                                        onMetadataApproved={async (metadata) => {
                                            try {
                                                await base44.entities.Video.update(selectedVideo.id, {
                                                    title: metadata.title,
                                                    description: metadata.description,
                                                    hashtags: metadata.hashtags.split('#').filter(h => h.trim()).map(h => h.trim()),
                                                    status: 'published',
                                                    youtube_url: 'https://youtube.com/watch?v=PLACEHOLDER', // TODO: Replace with actual YouTube URL
                                                    youtube_video_id: 'PLACEHOLDER' // TODO: Replace with actual video ID
                                                });

                                                toast.success('Video published to YouTube!');
                                                queryClient.invalidateQueries({ queryKey: ['videos'] });
                                                
                                                // Navigate to clip management
                                                navigate(createPageUrl('ClipManagement') + `?video_id=${selectedVideo.id}`, {
                                                    state: { video: { ...selectedVideo, status: 'published' } }
                                                });
                                            } catch (error) {
                                                toast.error('Publishing failed: ' + error.message);
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}