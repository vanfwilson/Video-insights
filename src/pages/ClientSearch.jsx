import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';

import SearchBar from '../components/search/SearchBar';
import TopicFilter from '../components/search/TopicFilter';
import SearchResults from '../components/search/SearchResults';
import ControlledYouTubePlayer from '../components/clip/ControlledYouTubePlayer';

export default function ClientSearch() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [selectedClip, setSelectedClip] = useState(null);
    const [searching, setSearching] = useState(false);

    const { data: topics = [] } = useQuery({
        queryKey: ['topics'],
        queryFn: () => base44.entities.Topic.list()
    });

    const { data: allClips = [] } = useQuery({
        queryKey: ['published-clips'],
        queryFn: () => base44.entities.Clip.filter({ status: 'published' })
    });

    const handleSearch = async (query) => {
        setSearchQuery(query);
        setSearching(true);

        // TODO: When you have SingleStore vector search, replace this with backend function
        // For now, use Base44's built-in AI search
        try {
            const clips = allClips.filter(clip => {
                const topicMatch = selectedTopics.length === 0 || 
                    clip.topics?.some(t => selectedTopics.includes(t));
                return topicMatch;
            });

            if (clips.length > 0) {
                const relevanceAnalysis = await base44.integrations.Core.InvokeLLM({
                    prompt: `User is searching for: "${query}"\n\nRank these training clips by relevance (0-1 score). Consider the query context and clip content.\n\nClips:\n${JSON.stringify(clips.map(c => ({ id: c.id, title: c.title, description: c.description, topics: c.topics })))}`,
                    response_json_schema: {
                        type: 'object',
                        properties: {
                            ranked_clips: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        clip_id: { type: 'string' },
                                        relevance_score: { type: 'number' }
                                    }
                                }
                            }
                        }
                    }
                });

                // Sort clips by AI relevance
                const sortedClipIds = relevanceAnalysis.ranked_clips
                    .sort((a, b) => b.relevance_score - a.relevance_score)
                    .map(r => r.clip_id);

                // Reorder original clips
                const sortedClips = sortedClipIds
                    .map(id => clips.find(c => c.id === id))
                    .filter(Boolean);

                setSearching(false);
                return sortedClips;
            }
        } catch (error) {
            console.error('Search error:', error);
        }

        setSearching(false);
    };

    const handleToggleTopic = (topicName) => {
        setSelectedTopics(prev =>
            prev.includes(topicName)
                ? prev.filter(t => t !== topicName)
                : [...prev, topicName]
        );
    };

    const filteredClips = allClips.filter(clip => {
        const topicMatch = selectedTopics.length === 0 || 
            clip.topics?.some(t => selectedTopics.includes(t));
        const searchMatch = !searchQuery || 
            clip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            clip.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return topicMatch && searchMatch;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 mb-4">Training Video Library</h1>
                    <p className="text-xl text-gray-600">
                        Find answers to your business challenges with expert training clips
                    </p>
                </div>

                <div className="mb-8">
                    <SearchBar onSearch={handleSearch} loading={searching} />
                </div>

                {topics.length > 0 && (
                    <div className="mb-8">
                        <TopicFilter
                            topics={topics}
                            selectedTopics={selectedTopics}
                            onToggleTopic={handleToggleTopic}
                        />
                    </div>
                )}

                {selectedClip ? (
                    <div className="mb-8">
                        <Card className="p-4">
                            <ControlledYouTubePlayer
                                videoId="dQw4w9WgXcQ"
                                startTime={selectedClip.start_time}
                                endTime={selectedClip.end_time}
                                title={selectedClip.title}
                            />
                            <div className="mt-4 flex justify-center">
                                <button
                                    onClick={() => setSelectedClip(null)}
                                    className="text-blue-600 hover:text-blue-800"
                                >
                                    ← Back to search results
                                </button>
                            </div>
                        </Card>
                    </div>
                ) : (
                    <SearchResults
                        results={filteredClips}
                        onSelectClip={setSelectedClip}
                    />
                )}
            </div>
        </div>
    );
}