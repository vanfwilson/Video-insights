import React, { useEffect, useRef, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from 'lucide-react';

export default function ControlledYouTubePlayer({ videoId, startTime, endTime, title }) {
    const playerRef = useRef(null);
    const containerRef = useRef(null);
    const [playerReady, setPlayerReady] = useState(false);

    useEffect(() => {
        // Load YouTube iframe API
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                setPlayerReady(true);
            };
        } else {
            setPlayerReady(true);
        }
    }, []);

    useEffect(() => {
        if (!playerReady || !containerRef.current) return;

        const player = new window.YT.Player(containerRef.current, {
            videoId: videoId,
            playerVars: {
                start: startTime,
                end: endTime,
                controls: 1,
                modestbranding: 1,
                rel: 0
            },
            events: {
                onStateChange: (event) => {
                    const currentTime = event.target.getCurrentTime();
                    
                    // Prevent seeking outside allowed range
                    if (currentTime < startTime - 1) {
                        event.target.seekTo(startTime);
                    } else if (currentTime > endTime + 1) {
                        event.target.pauseVideo();
                        event.target.seekTo(startTime);
                    }
                }
            }
        });

        playerRef.current = player;

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
            }
        };
    }, [playerReady, videoId, startTime, endTime]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Card className="overflow-hidden">
            <div className="aspect-video bg-black">
                <div ref={containerRef} className="w-full h-full" />
            </div>
            <div className="p-4 space-y-2">
                {title && <h3 className="font-semibold">{title}</h3>}
                <Alert>
                    <Lock className="w-4 h-4" />
                    <AlertDescription>
                        This clip is restricted to {formatTime(startTime)} - {formatTime(endTime)} 
                        ({Math.round((endTime - startTime) / 60)} minutes)
                    </AlertDescription>
                </Alert>
            </div>
        </Card>
    );
}