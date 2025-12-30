import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Shield } from 'lucide-react';

export default function ConfidentialityReview({ video, onUpdate }) {
    const [confidential, setConfidential] = useState(video.confidential || false);
    const [notes, setNotes] = useState(video.confidentiality_notes || '');

    const handleSave = () => {
        onUpdate({
            confidential,
            confidentiality_notes: notes
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Confidentiality Review
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <div>
                            <Label htmlFor="confidential-switch" className="text-sm font-medium">
                                Contains Confidential Information
                            </Label>
                            <p className="text-xs text-gray-600">
                                Flag this video if it contains client-sensitive content
                            </p>
                        </div>
                    </div>
                    <Switch
                        id="confidential-switch"
                        checked={confidential}
                        onCheckedChange={setConfidential}
                    />
                </div>

                {confidential && (
                    <div className="space-y-2">
                        <Label htmlFor="confidential-notes">Confidentiality Notes</Label>
                        <Textarea
                            id="confidential-notes"
                            placeholder="Describe what confidential information this video contains and why it shouldn't be public..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                )}

                <div className="flex gap-2">
                    <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                        Save Review
                    </Button>
                </div>

                {video.confidential && (
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Marked Confidential
                    </Badge>
                )}
            </CardContent>
        </Card>
    );
}