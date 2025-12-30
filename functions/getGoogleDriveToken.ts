import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Google Drive access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

        return Response.json({
            success: true,
            token: accessToken
        });

    } catch (error) {
        console.error('Token fetch error:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});