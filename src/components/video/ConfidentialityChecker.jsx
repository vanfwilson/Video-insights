import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ConfidentialityChecker({ captionsText, onResultsUpdate }) {
    const [checking, setChecking] = useState(false);
    const [results, setResults] = useState(null);

    const handleCheck = async () => {
        if (!captionsText) {
            toast.error('No captions to check');
            return;
        }

        setChecking(true);
        try {
            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze these video captions for confidential or sensitive information that should NOT be made public on YouTube. Look for:
- Client names, company names, or specific business details
- Personal identifying information (names, emails, phone numbers)
- Financial data or proprietary information
- Legal or HR matters
- Internal processes or strategies

Captions:
${captionsText}

Identify any concerns and provide timestamps if found.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        has_concerns: { type: 'boolean' },
                        risk_level: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
                        concerns: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    timestamp: { type: 'string' },
                                    issue: { type: 'string' },
                                    severity: { type: 'string', enum: ['low', 'medium', 'high'] }
                                }
                            }
                        },
                        recommendation: { type: 'string' }
                    }
                }
            });

            setResults(analysis);
            onResultsUpdate?.(analysis);
            
            if (analysis.has_concerns) {
                toast.warning('Confidentiality concerns found - review before publishing');
            } else {
                toast.success('No confidentiality concerns detected');
            }
        } catch (error) {
            toast.error('Confidentiality check failed: ' + error.message);
        } finally {
            setChecking(false);
        }
    };

    const riskColors = {
        none: 'bg-green-100 text-green-800 border-green-200',
        low: 'bg-blue-100 text-blue-800 border-blue-200',
        medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        high: 'bg-red-100 text-red-800 border-red-200'
    };

    const severityColors = {
        low: 'bg-blue-100 text-blue-800',
        medium: 'bg-yellow-100 text-yellow-800',
        high: 'bg-red-100 text-red-800'
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Confidentiality Check
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button
                    onClick={handleCheck}
                    disabled={checking || !captionsText}
                    className="w-full"
                >
                    {checking ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing captions...
                        </>
                    ) : (
                        <>
                            <Shield className="w-4 h-4 mr-2" />
                            Check for Confidential Content
                        </>
                    )}
                </Button>

                {results && (
                    <div className="space-y-4">
                        <Alert className={riskColors[results.risk_level]}>
                            <AlertDescription className="flex items-center gap-2">
                                {results.has_concerns ? (
                                    <AlertTriangle className="w-4 h-4" />
                                ) : (
                                    <CheckCircle className="w-4 h-4" />
                                )}
                                <div>
                                    <strong>Risk Level: {results.risk_level.toUpperCase()}</strong>
                                    <p className="text-sm mt-1">{results.recommendation}</p>
                                </div>
                            </AlertDescription>
                        </Alert>

                        {results.concerns && results.concerns.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Concerns Found:</h4>
                                {results.concerns.map((concern, idx) => (
                                    <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <span className="font-mono text-xs text-gray-600">
                                                {concern.timestamp}
                                            </span>
                                            <Badge className={severityColors[concern.severity]}>
                                                {concern.severity}
                                            </Badge>
                                        </div>
                                        <p className="text-sm">{concern.issue}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}