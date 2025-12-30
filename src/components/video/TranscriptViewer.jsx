import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Edit, Save, X } from 'lucide-react';

export default function TranscriptViewer({ transcript, onSave, editable = true }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTranscript, setEditedTranscript] = useState(transcript);

    const handleSave = () => {
        onSave?.(editedTranscript);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedTranscript(transcript);
        setIsEditing(false);
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Transcript
                    </CardTitle>
                    {editable && !isEditing && (
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                        </Button>
                    )}
                    {isEditing && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleCancel}>
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                                <Save className="w-4 h-4 mr-1" />
                                Save
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <Textarea
                        value={editedTranscript}
                        onChange={(e) => setEditedTranscript(e.target.value)}
                        className="min-h-[400px] font-mono text-sm"
                    />
                ) : (
                    <div className="bg-gray-50 rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {transcript || 'No transcript available yet...'}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}