import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from 'lucide-react';

export default function TopicFilter({ topics, selectedTopics, onToggleTopic }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter by Topic
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 flex-wrap">
                    {topics.map((topic) => (
                        <Badge
                            key={topic.id}
                            variant={selectedTopics.includes(topic.name) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => onToggleTopic(topic.name)}
                        >
                            {topic.name} ({topic.clip_count})
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}