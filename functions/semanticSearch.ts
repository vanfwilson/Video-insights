import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { query, limit = 10 } = await req.json();

        if (!query) {
            return Response.json({ error: 'Query is required' }, { status: 400 });
        }

        // Generate embedding for the search query
        const embeddingResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Generate a semantic embedding for this search query. Extract key concepts and intent: "${query}"`,
            response_json_schema: {
                type: 'object',
                properties: {
                    concepts: { type: 'array', items: { type: 'string' } },
                    intent: { type: 'string' }
                }
            }
        });

        // Get all published videos with transcripts
        const videos = await base44.asServiceRole.entities.Video.filter({
            status: 'published'
        });

        // Score videos based on semantic relevance
        const scoredResults = await Promise.all(
            videos
                .filter(v => v.transcript_text)
                .map(async (video) => {
                    // Use LLM to score relevance
                    const relevanceResult = await base44.integrations.Core.InvokeLLM({
                        prompt: `Rate how well this video transcript answers the user's question on a scale of 0-100.

User Question: "${query}"
User Intent: ${embeddingResult.intent}
Key Concepts: ${embeddingResult.concepts.join(', ')}

Video Title: ${video.title}
Video Transcript (first 2000 chars):
${video.transcript_text.substring(0, 2000)}

Provide a relevance score (0-100) and identify the most relevant time segments.`,
                        response_json_schema: {
                            type: 'object',
                            properties: {
                                relevance_score: { type: 'number' },
                                relevant_segments: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            start_time: { type: 'number' },
                                            end_time: { type: 'number' },
                                            reason: { type: 'string' }
                                        }
                                    }
                                },
                                summary: { type: 'string' }
                            }
                        }
                    });

                    return {
                        ...video,
                        relevance_score: relevanceResult.relevance_score,
                        relevant_segments: relevanceResult.relevant_segments,
                        match_summary: relevanceResult.summary
                    };
                })
        );

        // Sort by relevance and return top results
        const results = scoredResults
            .filter(r => r.relevance_score > 20)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, limit);

        return Response.json({
            success: true,
            query,
            results,
            total_found: results.length
        });
    } catch (error) {
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});