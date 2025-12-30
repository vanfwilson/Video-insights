import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function VideoUploader({ onVideoUploaded }) {
    const [uploading, setUploading] = useState(false);
    const [fileUrl, setFileUrl] = useState('');

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            // Create video entity
            const video = await base44.entities.Video.create({
                title: file.name.replace(/\.[^/.]+$/, ''),
                file_url: file_url,
                status: 'pending'
            });

            toast.success('Video uploaded successfully!');
            onVideoUploaded?.(video);
        } catch (error) {
            toast.error('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleUrlSubmit = async () => {
        if (!fileUrl) return;

        setUploading(true);
        try {
            const video = await base44.entities.Video.create({
                title: 'Video from URL',
                file_url: fileUrl,
                status: 'pending'
            });

            toast.success('Video added successfully!');
            onVideoUploaded?.(video);
            setFileUrl('');
        } catch (error) {
            toast.error('Failed to add video: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Add Video
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label htmlFor="file-upload" className="block mb-2">Upload Video File</Label>
                    <Input
                        id="file-upload"
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">Or</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="video-url">Google Drive URL or Direct Link</Label>
                    <div className="flex gap-2">
                        <Input
                            id="video-url"
                            placeholder="https://drive.google.com/file/..."
                            value={fileUrl}
                            onChange={(e) => setFileUrl(e.target.value)}
                            disabled={uploading}
                        />
                        <Button onClick={handleUrlSubmit} disabled={uploading || !fileUrl}>
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {uploading && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                    </div>
                )}
            </CardContent>
        </Card>
    );
}