import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fileId, fileName } = await req.json();

        if (!fileId) {
            return Response.json({ error: 'fileId is required' }, { status: 400 });
        }

        // Get Google Drive access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

        // Download file from Google Drive
        const driveResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!driveResponse.ok) {
            throw new Error(`Google Drive API error: ${driveResponse.statusText}`);
        }

        // Get file as blob
        const fileBlob = await driveResponse.blob();

        // Upload to Base44 storage
        const formData = new FormData();
        formData.append('file', fileBlob, fileName || 'video.mp4');

        const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
            file: fileBlob
        });

        return Response.json({
            success: true,
            file_url: uploadResult.file_url,
            file_name: fileName
        });

    } catch (error) {
        console.error('Download error:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});