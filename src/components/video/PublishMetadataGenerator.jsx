import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Check, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function PublishMetadataGenerator({ video, onMetadataApproved }) {
    const [generating, setGenerating] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [hashtags, setHashtags] = useState('');
    const [thumbnailPrompt, setThumbnailPrompt] = useState('');
    const [approved, setApproved] = useState({
        title: false,
        description: false,
        hashtags: false,
        thumbnailPrompt: false
    });

    useEffect(() => {
        if (video?.transcript_text && !title) {
            generateAllMetadata();
        }
    }, [video]);

    const generateAllMetadata = async () => {
        if (!video?.transcript_text) {
            toast.error('No captions available for this video');
            return;
        }

        setGenerating(true);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Based on these video captions with timestamps, generate YouTube metadata following these rules:

CAPTIONS:
${video.transcript_text}

REQUIREMENTS:
- Title: Under 60 characters, keyword-rich, clickable
- Description: Start with descriptive paragraphs including keywords. Add timestamps for key moments. Include 3-5 hashtags at the end.
- Hashtags: Exactly 3-5 relevant hashtags (format: #keyword)
- Thumbnail Prompt: Describe a 1280x720px custom thumbnail with high contrast, clear text overlay, eye-catching design

Generate all metadata now:`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        hashtags: { type: 'string' },
                        thumbnail_prompt: { type: 'string' }
                    }
                }
            });

            setTitle(result.title);
            setDescription(result.description);
            setHashtags(result.hashtags);
            setThumbnailPrompt(result.thumbnail_prompt);
            toast.success('Metadata generated! Review and approve each field.');
        } catch (error) {
            toast.error('Metadata generation failed: ' + error.message);
        } finally {
            setGenerating(false);
        }
    };

    const regenerateField = async (field) => {
        setGenerating(true);
        try {
            let prompt = '';
            let resultKey = '';

            if (field === 'title') {
                prompt = `Generate a YouTube title (under 60 chars, keyword-rich) for a video about: ${video.title || 'training video'}. Make it clickable and engaging.`;
                resultKey = 'title';
            } else if (field === 'description') {
                prompt = `Generate a YouTube description with keywords and timestamps based on: ${title}. Include 3-5 hashtags at the end.`;
                resultKey = 'description';
            } else if (field === 'hashtags') {
                prompt = `Generate exactly 3-5 relevant hashtags for a YouTube video titled: ${title}`;
                resultKey = 'hashtags';
            } else if (field === 'thumbnailPrompt') {
                prompt = `Generate a thumbnail design prompt for a 1280x720px YouTube thumbnail for: ${title}. High contrast, clear text, professional.`;
                resultKey = 'thumbnail_prompt';
            }

            const result = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        [resultKey]: { type: 'string' }
                    }
                }
            });

            if (field === 'title') setTitle(result.title);
            else if (field === 'description') setDescription(result.description);
            else if (field === 'hashtags') setHashtags(result.hashtags);
            else if (field === 'thumbnailPrompt') setThumbnailPrompt(result.thumbnail_prompt);

            toast.success(`${field} regenerated!`);
        } catch (error) {
            toast.error(`Failed to regenerate ${field}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleApprove = (field) => {
        setApproved({ ...approved, [field]: true });
    };

    const handlePublish = () => {
        if (!Object.values(approved).every(Boolean)) {
            toast.error('Please approve all metadata fields before publishing');
            return;
        }

        onMetadataApproved({
            title,
            description,
            hashtags,
            thumbnailPrompt
        });
    };

    const allApproved = Object.values(approved).every(Boolean);

    return (
        <div className="space-y-4">
            {generating && !title && (
                <Alert>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <AlertDescription>Generating YouTube metadata from captions...</AlertDescription>
                </Alert>
            )}

            {/* Title */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Title {approved.title && <Badge className="ml-2 bg-green-600">Approved</Badge>}</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regenerateField('title')}
                            disabled={generating}
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Regenerate
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label>Title (max 60 chars)</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={60}
                            placeholder="Enter video title..."
                        />
                        <p className="text-xs text-gray-500 mt-1">{title.length}/60 characters</p>
                    </div>
                    {title.length > 60 && (
                        <Alert variant="destructive">
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription>Title exceeds 60 character limit</AlertDescription>
                        </Alert>
                    )}
                    <Button
                        onClick={() => handleApprove('title')}
                        disabled={approved.title || !title || title.length > 60}
                        className="w-full"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        {approved.title ? 'Title Approved' : 'Approve Title'}
                    </Button>
                </CardContent>
            </Card>

            {/* Description */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Description {approved.description && <Badge className="ml-2 bg-green-600">Approved</Badge>}</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regenerateField('description')}
                            disabled={generating}
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Regenerate
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label>Description (with keywords & timestamps)</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter video description..."
                            className="min-h-[200px]"
                        />
                    </div>
                    <Button
                        onClick={() => handleApprove('description')}
                        disabled={approved.description || !description}
                        className="w-full"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        {approved.description ? 'Description Approved' : 'Approve Description'}
                    </Button>
                </CardContent>
            </Card>

            {/* Hashtags */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Hashtags {approved.hashtags && <Badge className="ml-2 bg-green-600">Approved</Badge>}</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regenerateField('hashtags')}
                            disabled={generating}
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Regenerate
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label>Hashtags (3-5 recommended)</Label>
                        <Input
                            value={hashtags}
                            onChange={(e) => setHashtags(e.target.value)}
                            placeholder="#leadership #training #business"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {hashtags.split('#').filter(h => h.trim()).length - 1} hashtags
                        </p>
                    </div>
                    <Button
                        onClick={() => handleApprove('hashtags')}
                        disabled={approved.hashtags || !hashtags}
                        className="w-full"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        {approved.hashtags ? 'Hashtags Approved' : 'Approve Hashtags'}
                    </Button>
                </CardContent>
            </Card>

            {/* Thumbnail Prompt */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Thumbnail Design {approved.thumbnailPrompt && <Badge className="ml-2 bg-green-600">Approved</Badge>}</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regenerateField('thumbnailPrompt')}
                            disabled={generating}
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Regenerate
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label>Thumbnail Prompt (1280x720px)</Label>
                        <Textarea
                            value={thumbnailPrompt}
                            onChange={(e) => setThumbnailPrompt(e.target.value)}
                            placeholder="Describe the thumbnail design..."
                            className="min-h-[100px]"
                        />
                    </div>
                    <Button
                        onClick={() => handleApprove('thumbnailPrompt')}
                        disabled={approved.thumbnailPrompt || !thumbnailPrompt}
                        className="w-full"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        {approved.thumbnailPrompt ? 'Thumbnail Prompt Approved' : 'Approve Thumbnail Prompt'}
                    </Button>
                </CardContent>
            </Card>

            {/* Final Publish Button */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="pt-6">
                    <Button
                        onClick={handlePublish}
                        disabled={!allApproved}
                        size="lg"
                        className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                    >
                        <Send className="w-5 h-5 mr-2" />
                        Publish to YouTube
                    </Button>
                    {!allApproved && (
                        <p className="text-xs text-gray-600 mt-3 text-center">
                            Approve all metadata fields to publish
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}