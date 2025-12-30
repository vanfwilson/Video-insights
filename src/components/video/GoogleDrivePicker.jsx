import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FolderOpen, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function GoogleDrivePicker({ onFilesUploaded }) {
    const [pickerLoaded, setPickerLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [uploadResults, setUploadResults] = useState([]);

    useEffect(() => {
        // Load Google Picker API
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            window.gapi.load('picker', () => {
                setPickerLoaded(true);
            });
        };
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handleOpenPicker = async () => {
        if (!pickerLoaded) {
            toast.error('Google Picker is still loading...');
            return;
        }

        try {
            // Get OAuth token from backend
            const tokenResponse = await base44.functions.invoke('getGoogleDriveToken', {});
            
            if (!tokenResponse.data.token) {
                throw new Error('Failed to get Google Drive access token');
            }

            // Create picker with real token
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(tokenResponse.data.token)
                .setCallback(handlePickerCallback)
                .setTitle('Select Files from Google Drive')
                .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
                .build();

            picker.setVisible(true);
        } catch (error) {
            toast.error('Failed to open Google Drive picker: ' + error.message);
        }
    };

    const handlePickerCallback = async (data) => {
        if (data.action === google.picker.Action.PICKED) {
            const files = data.docs;
            
            setUploading(true);
            setUploadProgress({ current: 0, total: files.length });
            setUploadResults([]);

            const results = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                try {
                    setUploadProgress({ current: i + 1, total: files.length });
                    toast.info(`Downloading ${file.name} from Google Drive...`);

                    // Download from Google Drive and upload to Base44
                    const response = await base44.functions.invoke('downloadFromGoogleDrive', {
                        fileId: file.id,
                        fileName: file.name
                    });

                    if (response.data.success) {
                        // Create video entity
                        const video = await base44.entities.Video.create({
                            title: file.name.replace(/\.[^/.]+$/, ''),
                            file_url: response.data.file_url,
                            status: 'draft'
                        });

                        results.push({
                            name: file.name,
                            success: true,
                            video
                        });
                    } else {
                        throw new Error(response.data.error || 'Upload failed');
                    }
                } catch (error) {
                    console.error(`Failed to upload ${file.name}:`, error);
                    toast.error(`Failed: ${file.name} - ${error.message}`);
                    results.push({
                        name: file.name,
                        success: false,
                        error: error.message
                    });
                }
            }

            setUploadResults(results);
            setUploading(false);

            const successCount = results.filter(r => r.success).length;
            if (successCount > 0) {
                toast.success(`${successCount} video(s) uploaded successfully!`);
                onFilesUploaded?.(results.filter(r => r.success).map(r => r.video));
            }
            if (successCount < results.length) {
                toast.error(`${results.length - successCount} video(s) failed to upload`);
            }
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Import from Google Drive</CardTitle>
                <p className="text-sm text-gray-600">
                    Select multiple files from your Google Drive to upload
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button
                    onClick={handleOpenPicker}
                    disabled={!pickerLoaded || uploading}
                    className="w-full"
                    size="lg"
                >
                    {!pickerLoaded ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Loading Google Picker...
                        </>
                    ) : uploading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Uploading {uploadProgress.current}/{uploadProgress.total}...
                        </>
                    ) : (
                        <>
                            <FolderOpen className="w-5 h-5 mr-2" />
                            Select Files from Google Drive
                        </>
                    )}
                </Button>

                {uploading && (
                    <div className="space-y-2">
                        <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
                        <p className="text-sm text-center text-gray-600">
                            Uploading {uploadProgress.current} of {uploadProgress.total} files...
                        </p>
                    </div>
                )}

                {uploadResults.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Upload Results:</h4>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {uploadResults.map((result, idx) => (
                                <Alert
                                    key={idx}
                                    variant={result.success ? 'default' : 'destructive'}
                                    className="py-2"
                                >
                                    <AlertDescription className="flex items-center gap-2">
                                        {result.success ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                        )}
                                        <span className="flex-1">{result.name}</span>
                                        {!result.success && (
                                            <span className="text-xs text-red-600">{result.error}</span>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}