import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { video_url } = await req.json();

        if (!video_url) {
            return Response.json({ error: 'video_url is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get('ASSEMBLYAI');
        if (!apiKey) {
            return Response.json({ error: 'AssemblyAI API key not configured' }, { status: 500 });
        }

        // Step 1: Upload video to AssemblyAI
        const videoResponse = await fetch(video_url);
        const videoBlob = await videoResponse.blob();

        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'authorization': apiKey
            },
            body: videoBlob
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload video to AssemblyAI');
        }

        const { upload_url } = await uploadResponse.json();

        // Step 2: Request transcription
        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'authorization': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                audio_url: upload_url
            })
        });

        const { id: transcriptId } = await transcriptResponse.json();

        // Step 3: Poll for completion (wait 30 seconds initially, then poll)
        await new Promise(resolve => setTimeout(resolve, 30000));

        let transcript = null;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max

        while (attempts < maxAttempts) {
            const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: {
                    'authorization': apiKey
                }
            });

            transcript = await pollResponse.json();

            if (transcript.status === 'completed') {
                break;
            } else if (transcript.status === 'error') {
                throw new Error('Transcription failed');
            }

            // Wait 5 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        if (transcript.status !== 'completed') {
            throw new Error('Transcription timeout');
        }

        // Step 4: Get SRT format
        const srtResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}/srt`, {
            headers: {
                'authorization': apiKey
            }
        });

        const srtText = await srtResponse.text();

        return Response.json({
            success: true,
            captions: srtText,
            transcript_id: transcriptId
        });

    } catch (error) {
        console.error('Caption generation error:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});