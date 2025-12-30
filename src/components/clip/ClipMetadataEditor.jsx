import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Sparkles } from 'lucide-react';

const AVAILABLE_TOPICS = [
    'Human Relations',
    'Leadership',
    'Communication',
    'Management',
    'Training',
    'Conflict Resolution',
    'Team Building',
    'Performance Management'
];

export default function ClipMetadataEditor({ clip, onSave, onCancel }) {
    const [metadata, setMetadata] = useState({
        title: clip.title || '',
        description: clip.description || '',
        hashtags: clip.hashtags || [],
        topics: clip.topics || []
    });
    const [newHashtag, setNewHashtag] = useState('');

    const handleAddHashtag = () => {
        if (newHashtag && !metadata.hashtags.includes(newHashtag)) {
            setMetadata({
                ...metadata,
                hashtags: [...metadata.hashtags, newHashtag.replace('#', '')]
            });
            setNewHashtag('');
        }
    };

    const handleRemoveHashtag = (tag) => {
        setMetadata({
            ...metadata,
            hashtags: metadata.hashtags.filter(t => t !== tag)
        });
    };

    const handleToggleTopic = (topic) => {
        if (metadata.topics.includes(topic)) {
            setMetadata({
                ...metadata,
                topics: metadata.topics.filter(t => t !== topic)
            });
        } else {
            setMetadata({
                ...metadata,
                topics: [...metadata.topics, topic]
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Edit Clip Metadata
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                        id="title"
                        value={metadata.title}
                        onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                        placeholder="Enter clip title..."
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        value={metadata.description}
                        onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                        placeholder="Enter clip description..."
                        className="min-h-[100px]"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Topics</Label>
                    <div className="flex gap-2 flex-wrap">
                        {AVAILABLE_TOPICS.map((topic) => (
                            <Badge
                                key={topic}
                                variant={metadata.topics.includes(topic) ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => handleToggleTopic(topic)}
                            >
                                {topic}
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="hashtags">Hashtags</Label>
                    <div className="flex gap-2">
                        <Input
                            id="hashtags"
                            value={newHashtag}
                            onChange={(e) => setNewHashtag(e.target.value)}
                            placeholder="Add hashtag..."
                            onKeyPress={(e) => e.key === 'Enter' && handleAddHashtag()}
                        />
                        <Button type="button" size="icon" onClick={handleAddHashtag}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap mt-2">
                        {metadata.hashtags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                                #{tag}
                                <X 
                                    className="w-3 h-3 cursor-pointer" 
                                    onClick={() => handleRemoveHashtag(tag)}
                                />
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 pt-4">
                    <Button onClick={() => onSave(metadata)} className="bg-green-600 hover:bg-green-700">
                        Save Changes
                    </Button>
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}