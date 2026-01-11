import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupClerkAuth, isAuthenticated, getUserId, getUserFromDb, upsertUserToDb, getClerkClientForRequest } from "./clerkAuth";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes, openai as openaiClient } from "./replit_integrations/image";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import axios from "axios";
import { db } from "./db";
import { videos, users, type UserRole } from "@shared/schema";
import { eq } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Configure Multer
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 0. Clerk config endpoint (public - publishable keys are safe to expose)
  // Always uses production keys - add Replit preview URL to Clerk's allowed origins
  app.get("/api/clerk-config", (req, res) => {
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
    res.json({ publishableKey });
  });

  // 1. Setup Clerk Auth
  setupClerkAuth(app);
  
  // 2. Auth Routes for Clerk
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get Clerk user and sync to database (use appropriate client for domain)
      const client = getClerkClientForRequest(req);
      const clerkUser = await client.users.getUser(userId);
      
      await upsertUserToDb({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || null,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        profileImageUrl: clerkUser.imageUrl,
      });
      
      // Get user from our database (includes role)
      const dbUser = await getUserFromDb(userId);
      
      res.json(dbUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // 3. Setup AI Integrations
  registerChatRoutes(app);
  registerImageRoutes(app);

  // Serve uploads publicly so the external transcription API can access them
  app.use('/uploads', express.static('uploads'));

  // 4. Video Routes

  // Upload Video
  app.post(api.videos.upload.path, isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const video = await storage.createVideo({
        userId, // From Clerk
        originalFilename: req.file.originalname,
        storagePath: req.file.path,
        status: "uploading",
      });

      // Start processing in background
      // Use the host header to construct the URL
      const protocol = req.protocol;
      const host = req.get('host');
      const publicUrl = `${protocol}://${host}/uploads/${path.basename(req.file.path)}`;
      
      processVideo(video.id, publicUrl).catch(console.error);

      res.status(201).json(video);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // List Videos
  app.get(api.videos.list.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const videos = await storage.getVideosByUser(userId);
    res.json(videos);
  });

  // Get Video
  app.get(api.videos.get.path, async (req, res) => {
    const video = await storage.getVideo(Number(req.params.id));
    if (!video) return res.status(404).json({ message: "Video not found" });
    res.json(video);
  });

  // Get Status (Optimization for polling)
  app.get(api.videos.status.path, async (req, res) => {
    const video = await storage.getVideo(Number(req.params.id));
    if (!video) return res.status(404).json({ message: "Video not found" });
    res.json({ status: video.status });
  });

  // Upload Speaker Image
  app.post("/api/videos/:id/speaker-image", upload.single('file'), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      
      const protocol = req.protocol;
      const host = req.get('host');
      const publicUrl = `${protocol}://${host}/uploads/${path.basename(req.file.path)}`;
      
      await storage.updateVideo(id, { speakerImageUrl: publicUrl });
      res.json({ url: publicUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Upload Thumbnail directly
  app.post("/api/videos/:id/upload-thumbnail", upload.single('file'), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      
      // Use relative path for consistency (frontend will prepend host when needed)
      const url = `/uploads/${path.basename(req.file.path)}`;
      
      await storage.updateVideo(id, { thumbnailUrl: url });
      res.json({ url });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Thumbnail upload failed" });
    }
  });

  // Update Metadata
  app.patch(api.videos.update.path, async (req, res) => {
    const id = Number(req.params.id);
    const video = await storage.getVideo(id);
    if (!video) return res.status(404).json({ message: "Video not found" });
    
    // Parse partial input
    const updates = api.videos.update.input.parse(req.body);
    const updated = await storage.updateVideo(id, updates);
    res.json(updated);
  });

  // AI Analyze Content Boundaries - suggests where educational content begins and ends
  app.post("/api/videos/:id/analyze-content-start", async (req, res) => {
    const id = Number(req.params.id);
    const video = await storage.getVideo(id);
    if (!video) return res.status(404).json({ message: "Video not found" });
    if (!video.transcript) return res.status(400).json({ message: "No transcript available" });

    try {
      const transcript = video.transcript;
      
      // Analyze the beginning of the transcript for start point
      const startCompletion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert at analyzing video transcripts to find where the educational/valuable content begins.

Your task is to identify the timestamp where the ACTUAL educational or data-driven content starts - NOT where talking starts, but where the VALUE begins.

Skip over ALL of these:
- Technical setup: "can you hear me?", "testing", "let me share my screen"
- Waiting: "we'll give people a minute to join", "waiting for a few more"
- Small talk: "how was your weekend?", casual conversation
- Speaker introductions: "I'm John from Company X, I've been doing this for 20 years"
- Company introductions: "Today we have the team from ABC Corp joining us"
- Agenda reading: "Today we're going to cover X, Y, and Z" (unless this IS the start of content)
- Welcomes and thank yous: "Thanks everyone for joining", "Welcome to today's webinar"

The REAL educational content typically starts when:
- The presenter starts teaching actual concepts or sharing data
- Charts, statistics, or specific information is being discussed
- The "meat" of the presentation begins (after all introductions)
- The first substantive point or lesson begins
- Training or educational material starts being delivered

Return JSON with:
- suggestedStartMs: timestamp in milliseconds where valuable content begins
- reason: brief explanation (what was being skipped and why this point was chosen)
- confidence: low/medium/high based on how clear the transition is`
          },
          { 
            role: "user", 
            content: `Analyze this transcript beginning to find where the educational content starts:\n\n${transcript.substring(0, 12000)}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const startContent = startCompletion.choices[0]?.message?.content;
      let suggestedStartMs = 0;
      let startReason = "";
      let startConfidence = "low";
      
      if (startContent) {
        const result = JSON.parse(startContent);
        suggestedStartMs = parseInt(result.suggestedStartMs) || 0;
        startReason = result.reason || "";
        startConfidence = result.confidence || "low";
      }
      
      // Save the suggestion to the database
      await storage.updateVideo(id, { suggestedStartMs });
      
      res.json({
        suggestedStartMs,
        reason: startReason,
        confidence: startConfidence
      });
    } catch (err) {
      console.error("Content start analysis error:", err);
      res.status(500).json({ message: "Analysis failed" });
    }
  });
  
  // AI Analyze Content End - suggests where to end (before sales pitch/closing)
  app.post("/api/videos/:id/analyze-content-end", async (req, res) => {
    const id = Number(req.params.id);
    const video = await storage.getVideo(id);
    if (!video) return res.status(404).json({ message: "Video not found" });
    if (!video.transcript) return res.status(400).json({ message: "No transcript available" });

    try {
      const transcript = video.transcript;
      const transcriptLength = transcript.length;
      
      // Analyze the end portion of the transcript
      const endPortion = transcript.substring(Math.max(0, transcriptLength - 15000));
      
      const endCompletion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert at analyzing video transcripts to find where the educational content ends and non-essential closing content begins.

Your task is to identify where the valuable educational content ENDS, so the video can be trimmed to remove:
- Sales pitches: pricing discussions, "special offers", "sign up now"
- Call to action closing: "visit our website", "schedule a demo", "contact us"
- Q&A wrap-up: If there's useful Q&A keep it, but skip "thanks for the questions"
- Closing pleasantries: "thanks everyone", "have a great day", "bye everyone"
- Next steps/housekeeping: "we'll send the slides", "recording will be available"

The educational content typically ENDS when:
- The teaching/training portion is complete
- The presenter transitions to "selling" mode
- Pricing or packages are discussed
- The Q&A ends and wrap-up begins
- Closing thank-yous start

Return JSON with:
- suggestedEndMs: timestamp in milliseconds where to cut (before the non-essential closing)
- reason: brief explanation of what content would be cut
- confidence: low/medium/high
- shouldTrim: true if there's content worth cutting, false if video should go to the natural end`
          },
          { 
            role: "user", 
            content: `Analyze this transcript ending to find where the educational content ends:\n\n${endPortion}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const endContent = endCompletion.choices[0]?.message?.content;
      if (endContent) {
        const result = JSON.parse(endContent);
        res.json({
          suggestedEndMs: result.shouldTrim ? (parseInt(result.suggestedEndMs) || null) : null,
          reason: result.reason || "",
          confidence: result.confidence || "low",
          shouldTrim: result.shouldTrim || false
        });
      } else {
        res.status(500).json({ message: "AI analysis failed" });
      }
    } catch (err) {
      console.error("Content end analysis error:", err);
      res.status(500).json({ message: "Analysis failed" });
    }
  });

  // Save trim times
  app.patch("/api/videos/:id/trim", async (req, res) => {
    const id = Number(req.params.id);
    const video = await storage.getVideo(id);
    if (!video) return res.status(404).json({ message: "Video not found" });

    const { trimStartMs, trimEndMs } = req.body;
    
    // Validate trim times
    if (trimStartMs !== undefined && trimStartMs !== null) {
      if (typeof trimStartMs !== 'number' || trimStartMs < 0) {
        return res.status(400).json({ message: "Invalid start time" });
      }
    }
    if (trimEndMs !== undefined && trimEndMs !== null) {
      if (typeof trimEndMs !== 'number' || trimEndMs < 0) {
        return res.status(400).json({ message: "Invalid end time" });
      }
      if (trimStartMs !== undefined && trimEndMs <= trimStartMs) {
        return res.status(400).json({ message: "End time must be after start time" });
      }
    }

    const updated = await storage.updateVideo(id, { 
      trimStartMs: trimStartMs ?? null, 
      trimEndMs: trimEndMs ?? null 
    });
    res.json(updated);
  });

  // ========== CLIP ROUTES ==========

  // Get all clips for a parent video
  app.get('/api/videos/:id/clips', async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const parentId = Number(req.params.id);
      
      // Verify user owns the parent video
      const parentVideo = await storage.getVideo(parentId);
      if (!parentVideo) {
        return res.status(404).json({ message: "Video not found" });
      }
      if (parentVideo.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const clips = await storage.getClipsForVideo(parentId, userId);
      res.json(clips);
    } catch (error) {
      console.error("Error fetching clips:", error);
      res.status(500).json({ message: "Failed to fetch clips" });
    }
  });

  // AI-powered clip suggestion
  app.post('/api/videos/:id/suggest-clips', async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const parentId = Number(req.params.id);
      const { customPrompt } = req.body || {};
      const video = await storage.getVideo(parentId);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      if (video.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!video.transcript) {
        return res.status(400).json({ message: "No transcript available for clip analysis" });
      }
      if (!video.youtubeId) {
        return res.status(400).json({ message: "Video must be published to YouTube first" });
      }

      // Calculate trim offset - if video was trimmed, transcript timestamps need adjustment
      const trimOffsetSec = video.trimStartMs ? Math.floor(video.trimStartMs / 1000) : 0;
      const hasOffset = trimOffsetSec > 0;
      
      console.log(`[Clip Suggest] Analyzing video ${parentId} for viral clips (trim offset: ${trimOffsetSec}s)`);

      // Build custom instruction if user provided one
      const customInstruction = customPrompt && typeof customPrompt === 'string' && customPrompt.trim()
        ? `\n\nUSER GUIDANCE: ${customPrompt.trim().substring(0, 500)}\n`
        : '';

      // Use OpenAI to analyze transcript and suggest viral clips
      const prompt = `You are a viral content expert. Analyze this video transcript and identify the best 3-5 potential viral short clips (30-90 seconds each).
${hasOffset ? `\nIMPORTANT: This transcript has timestamps from the ORIGINAL recording. The published YouTube video was TRIMMED - it starts ${trimOffsetSec} seconds into the original. So timestamp "00:05:00" in the transcript corresponds to 0:00 in the published video. When you provide startSec and endSec values, give times relative to the PUBLISHED YouTube video (subtract ${trimOffsetSec} seconds from any transcript timestamps you reference). Do not suggest clips that would have negative start times.` : ''}
${customInstruction}
For each clip, provide:
1. startSec: Start time in seconds (relative to the published YouTube video, NOT the original transcript)
2. endSec: End time in seconds (clip should be 30-90 seconds)
3. title: A catchy, clickable title under 60 characters
4. description: Brief description under 200 characters
5. hashtags: 3-5 relevant hashtags (comma-separated, include #shorts)
6. sentiment: The emotional tone (positive, negative, neutral, inspiring, controversial, humorous)
7. priority: Score 1-10 based on viral potential
8. reason: Brief explanation of why this clip would go viral

Look for:
- Emotional peaks or surprising moments
- Quotable statements or strong opinions
- Controversial or thought-provoking content
- Inspiring or motivational segments
- Funny or entertaining moments
- Key insights or revelations

TRANSCRIPT:
${video.transcript.substring(0, 15000)}

Respond with a JSON object: { "clips": [...] }`;

      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("[Clip Suggest] Failed to parse AI response:", content);
        return res.status(500).json({ message: "Failed to parse AI suggestions" });
      }

      console.log(`[Clip Suggest] Found ${parsed.clips?.length || 0} potential clips`);
      res.json({ clips: parsed.clips || [] });
    } catch (error: any) {
      console.error("Error suggesting clips:", error);
      res.status(500).json({ message: error.message || "Failed to suggest clips" });
    }
  });

  // Create a new clip from a parent video
  app.post('/api/videos/:id/clips', async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const parentId = Number(req.params.id);
      const { startSec, endSec, title, description, hashtags, thumbnailPrompt } = req.body;

      const parentVideo = await storage.getVideo(parentId);
      if (!parentVideo) {
        return res.status(404).json({ message: "Parent video not found" });
      }
      if (parentVideo.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate times
      if (typeof startSec !== 'number' || typeof endSec !== 'number') {
        return res.status(400).json({ message: "Start and end times are required" });
      }
      if (endSec <= startSec) {
        return res.status(400).json({ message: "End time must be after start time" });
      }

      // Create clip as a new video entry with parent reference
      // Sanitize inputs - only allow specific whitelisted fields
      const safeTitle = typeof title === 'string' ? title.substring(0, 200) : "";
      const safeDescription = typeof description === 'string' ? description.substring(0, 2000) : "";
      const safeHashtags = typeof hashtags === 'string' ? hashtags.substring(0, 500) : "";
      const safeThumbnailPrompt = typeof thumbnailPrompt === 'string' ? thumbnailPrompt.substring(0, 500) : "";
      
      const clip = await storage.createVideo({
        userId, // userId is derived from req.user.claims.sub above, not from client
        originalFilename: `clip_${parentId}_${startSec}-${endSec}.mp4`,
        storagePath: parentVideo.storagePath,
        status: "ready_to_edit",
        parentVideoId: parentId,
        startSec,
        endSec,
        title: safeTitle,
        description: safeDescription,
        hashtags: safeHashtags,
        thumbnailPrompt: safeThumbnailPrompt,
        language: parentVideo.language,
        speakerImageUrl: parentVideo.speakerImageUrl,
      });

      console.log(`[Clip Create] Created clip ${clip.id} from parent ${parentId} (${startSec}s - ${endSec}s)`);
      res.status(201).json(clip);
    } catch (error: any) {
      console.error("Error creating clip:", error);
      res.status(500).json({ message: error.message || "Failed to create clip" });
    }
  });

  // Admin: Get all videos across the platform
  app.get('/api/admin/all-videos', async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const user = await getUserFromDb(userId);
    
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      const allVideos = await storage.getAllVideos();
      res.json(allVideos);
    } catch (error) {
      console.error("Error fetching all videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Generate Metadata (AI)
  app.post(api.videos.generateMetadata.path, async (req, res) => {
    const id = Number(req.params.id);
    const video = await storage.getVideo(id);
    if (!video) return res.status(404).json({ message: "Video not found" });
    if (!video.transcript) return res.status(400).json({ message: "No transcript available yet" });

    // Update status
    await storage.updateVideo(id, { status: "generating_metadata" });

    // Background generation
    generateMetadata(id, video.transcript).catch(console.error);

    res.json(await storage.getVideo(id));
  });

  // Generate Thumbnail (AI) with speaker image compositing
    app.post(api.videos.generateThumbnail.path, async (req, res) => {
        const id = Number(req.params.id);
        const { prompt } = req.body;
        
        try {
            console.log(`[Image Gen] Triggering image generation for video ${id} with prompt: ${prompt}`);
            
            if (!prompt) {
                return res.status(400).json({ message: "Thumbnail prompt is required" });
            }

            const video = await storage.getVideo(id);
            if (!video) return res.status(404).json({ message: "Video not found" });

            // Check for speaker image to include
            let speakerFilePath: string | null = null;
            if (video.speakerImageUrl) {
                // Extract filename from URL
                try {
                    const urlObj = new URL(video.speakerImageUrl);
                    const fileName = path.basename(urlObj.pathname);
                    const testPath = path.join('uploads', fileName);
                    if (fs.existsSync(testPath)) {
                        speakerFilePath = testPath;
                    }
                } catch {
                    const testPath = path.join('uploads', path.basename(video.speakerImageUrl));
                    if (fs.existsSync(testPath)) {
                        speakerFilePath = testPath;
                    }
                }
            }
            
            let imageBuffer: Buffer;
            
            if (speakerFilePath) {
                // Use OpenAI's image EDIT API to incorporate the speaker image directly
                console.log(`[Image Gen] Using OpenAI edit API with speaker image: ${speakerFilePath}`);
                
                const { editImages } = await import('./replit_integrations/image/client');
                const sharp = (await import('sharp')).default;
                
                // Convert speaker image to PNG for the API
                const pngPath = path.join('uploads', `temp_speaker_${Date.now()}.png`);
                await sharp(speakerFilePath).png().toFile(pngPath);
                
                // Use the edit API - it will incorporate the uploaded image into the scene
                const editPrompt = `Create a professional YouTube thumbnail. 
The attached image shows the speaker/host of this video. 
Incorporate this person prominently into a scene about: ${prompt}
Make it look like a professional, eye-catching YouTube thumbnail with the speaker visible.`;
                
                imageBuffer = await editImages([pngPath], editPrompt);
                
                // Clean up temp file
                fs.unlinkSync(pngPath);
                
                console.log(`[Image Gen] Edit API returned image: ${imageBuffer.length} bytes`);
            } else {
                // No speaker image - just generate a background
                console.log(`[Image Gen] No speaker image, generating with text prompt only`);
                
                let bgB64: string | undefined;
                try {
                    const { generateImageWithGemini } = await import('./replit_integrations/image/client');
                    bgB64 = await generateImageWithGemini(prompt);
                } catch (geminiErr: any) {
                    console.log(`[Image Gen] Gemini failed, falling back to OpenAI: ${geminiErr.message}`);
                    const bgResponse = await openaiClient.images.generate({
                        model: "gpt-image-1",
                        prompt: prompt,
                        size: "1024x1024",
                    });
                    bgB64 = bgResponse.data?.[0]?.b64_json;
                }
                
                if (!bgB64) {
                    return res.status(500).json({ message: "Failed to generate image" });
                }
                imageBuffer = Buffer.from(bgB64, 'base64');
            }
            
            // Save the final image
            const fileName = `thumb_${id}_${Date.now()}.png`;
            const filePath = path.join('uploads', fileName);
            fs.writeFileSync(filePath, imageBuffer);
            const url = `/uploads/${fileName}`;
            
            console.log(`[Image Gen] Successfully generated thumbnail: ${url}`);
            await storage.updateVideo(id, { thumbnailUrl: url });
            res.json({ url });
            
        } catch (e: any) {
            console.error(`[Image Gen] Error generating thumbnail for video ${id}:`, e.message || e);
            const errorMessage = e.message || "Unknown error";
            res.status(500).json({ message: `Failed to generate thumbnail: ${errorMessage}` });
        }
    });


  // Publish to YouTube
  app.post(api.videos.publish.path, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const video = await storage.getVideo(id);
    if (!video) return res.status(404).json({ message: "Video not found" });
    
    // Get user role and default channel
    const user = await getUserFromDb(userId);
    const userRole = user?.role as UserRole || 'search';
    
    // Check permission - only admin, superadmin, and creative can publish
    if (!['superadmin', 'admin', 'creative'].includes(userRole)) {
      return res.status(403).json({ message: "You do not have permission to publish videos" });
    }
    
    // Determine channel ID based on role
    let channelId: string | undefined;
    
    if (userRole === 'creative') {
      // Creative users MUST use their default channel - ignore any request body
      if (!user?.defaultChannelId) {
        return res.status(403).json({ message: "No default channel assigned. Contact an admin." });
      }
      channelId = user.defaultChannelId;
      console.log(`[YouTube Publish] Creative user publishing to default channel: ${channelId}`);
    } else {
      // Admin/superadmin can choose any channel
      channelId = req.body?.channel_id;
      if (channelId) {
        console.log(`[YouTube Publish] Admin/superadmin using channel: ${channelId}`);
      }
    }

    await storage.updateVideo(id, { status: "publishing" });
    
    // Background publish with channel_id
    publishToYouTube(id, video, channelId).then(()=>{}).catch(async (e: any) => {
        const errorDetails = {
          message: e.message,
          status: e.response?.status,
          statusText: e.response?.statusText,
          data: e.response?.data,
          code: e.code
        };
        console.error("[YouTube Publish] FAILED:", errorDetails);
        
        // Build user-friendly error message
        let errorMessage = e.message || "Unknown error";
        if (e.response?.status) {
          errorMessage = `HTTP ${e.response.status}: ${e.response.statusText || e.message}`;
        }
        if (e.response?.data?.error) {
          errorMessage += ` - ${JSON.stringify(e.response.data.error)}`;
        } else if (e.response?.data?.message) {
          errorMessage += ` - ${e.response.data.message}`;
        }
        if (e.code) {
          errorMessage += ` (Code: ${e.code})`;
        }
        
        await storage.updateVideo(id, { status: "failed", errorMessage });
    });

    res.json(await storage.getVideo(id));
  });

  // ========== CONFIDENTIALITY CHECK ROUTES ==========

  // Run confidentiality check on video transcript
  app.post('/api/videos/:id/confidentiality-check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const videoId = Number(req.params.id);
      
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      if (video.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!video.transcript) {
        return res.status(400).json({ message: "No transcript available. Video must be transcribed first." });
      }
      
      console.log(`[Confidentiality Check] Starting analysis for video ${videoId}`);
      
      // Create the check record
      const check = await storage.createConfidentialityCheck({
        videoId,
        status: "running",
        triggeredBy: userId,
        modelUsed: "gpt-4o"
      });
      
      // Update video status
      await storage.updateVideo(videoId, { 
        confidentialityStatus: "checking",
        lastConfidentialityCheckId: check.id
      });
      
      // AI analysis prompt
      const prompt = `You are a compliance auditor reviewing video transcripts before public publishing. Analyze this transcript and identify any content that may be confidential, proprietary, or sensitive.

Flag content that contains:
1. **Proprietary Information**: Trade secrets, proprietary processes, internal strategies, competitive advantages
2. **Financial Information**: Revenue numbers, profit margins, budget details, salary information, stock/investment details
3. **Personal/Health Information (PII/PHI)**: Names of private individuals (not public figures), addresses, phone numbers, medical conditions, personal situations
4. **Company Secrets**: Internal company names (especially clients/partners), undisclosed business relationships, internal project codenames, confidential agreements

For each flagged segment, provide:
- startTime: Approximate start time in HH:MM:SS format
- endTime: Approximate end time in HH:MM:SS format
- category: One of "proprietary", "financial", "personal_health", "company_secret", "other"
- severity: "low" (might be sensitive), "medium" (should review), "high" (definitely shouldn't publish)
- reason: Brief explanation of why this content is flagged
- confidence: 0.0-1.0 confidence score

If the transcript appears safe for public publishing, return an empty segments array.

TRANSCRIPT:
${video.transcript.substring(0, 20000)}

Respond with JSON only:
{
  "status": "clear" or "flagged",
  "summary": "Brief overall assessment",
  "segments": [
    {
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS", 
      "category": "category_name",
      "severity": "low|medium|high",
      "reason": "explanation",
      "confidence": 0.0-1.0
    }
  ]
}`;

      try {
        const response = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 3000,
        });

        const content = response.choices[0]?.message?.content || "{}";
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          console.error("[Confidentiality Check] Failed to parse AI response:", content);
          await storage.updateConfidentialityCheck(check.id, { 
            status: "error", 
            errorMessage: "Failed to parse AI response" 
          });
          await storage.updateVideo(videoId, { confidentialityStatus: "error" });
          return res.status(500).json({ message: "Failed to parse AI response" });
        }

        // Count severities and add IDs to segments
        const rawSegments = parsed.segments || [];
        const segments = rawSegments.map((s: any, idx: number) => ({
          ...s,
          id: `seg_${check.id}_${idx}`,
          resolutionStatus: "pending"
        }));
        
        const highCount = segments.filter((s: any) => s.severity === 'high').length;
        const mediumCount = segments.filter((s: any) => s.severity === 'medium').length;
        const lowCount = segments.filter((s: any) => s.severity === 'low').length;

        // Update the check record
        const updatedCheck = await storage.updateConfidentialityCheck(check.id, {
          status: "completed",
          overallStatus: segments.length > 0 ? "flagged" : "clear",
          segments,
          summary: parsed.summary || null,
          highCount,
          mediumCount,
          lowCount,
        });

        // Update video status
        await storage.updateVideo(videoId, { 
          confidentialityStatus: segments.length > 0 ? "flagged" : "clear"
        });

        console.log(`[Confidentiality Check] Completed for video ${videoId}: ${segments.length} segments flagged`);
        res.json(updatedCheck);
        
      } catch (aiError: any) {
        console.error("[Confidentiality Check] AI error:", aiError);
        await storage.updateConfidentialityCheck(check.id, { 
          status: "error", 
          errorMessage: aiError.message || "AI analysis failed" 
        });
        await storage.updateVideo(videoId, { confidentialityStatus: "error" });
        res.status(500).json({ message: aiError.message || "AI analysis failed" });
      }
      
    } catch (error: any) {
      console.error("Error running confidentiality check:", error);
      res.status(500).json({ message: error.message || "Failed to run confidentiality check" });
    }
  });

  // Get latest confidentiality check for a video
  app.get('/api/videos/:id/confidentiality-check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const videoId = Number(req.params.id);
      
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      if (video.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const check = await storage.getLatestConfidentialityCheck(videoId);
      res.json(check || null);
    } catch (error: any) {
      console.error("Error fetching confidentiality check:", error);
      res.status(500).json({ message: error.message || "Failed to fetch confidentiality check" });
    }
  });

  // Update confidentiality segment resolution status (admin only)
  const updateSegmentResolutionSchema = z.object({
    resolutionStatus: z.enum(["pending", "resolved", "ignored"]),
    resolutionNote: z.string().optional(),
  });

  // ========== ADMIN ROUTES ==========
  
  // Helper to get user with role from database
  async function getUserWithRole(userId: string): Promise<{ role: UserRole | null; defaultChannelId: string | null }> {
    const user = await getUserFromDb(userId);
    return { 
      role: user?.role as UserRole || null,
      defaultChannelId: user?.defaultChannelId || null
    };
  }
  
  // Superadmin-only middleware (only vanwilson - user management)
  const requireSuperadmin = async (req: any, res: any, next: any) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { role } = await getUserWithRole(userId);
    if (role !== 'superadmin') return res.status(403).json({ message: "Superadmin access required" });
    next();
  };
  
  // Admin-or-above middleware (superadmin or admin - can manage channels)
  const requireAdmin = async (req: any, res: any, next: any) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { role } = await getUserWithRole(userId);
    if (role !== 'superadmin' && role !== 'admin') return res.status(403).json({ message: "Admin access required" });
    next();
  };
  
  // Get all users (superadmin only)
  app.get('/api/admin/users', requireSuperadmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // For each user, also get their assigned channels
      const usersWithChannels = await Promise.all(
        allUsers.map(async (user) => ({
          ...user,
          channels: await storage.getUserChannels(user.id)
        }))
      );
      res.json(usersWithChannels);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Create user manually (superadmin only)
  const createUserSchema = z.object({
    email: z.string().email("Valid email is required"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.enum(["admin", "creative", "search"]),
    defaultChannelId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    channelIds: z.array(z.string()).optional(),
  });
  
  app.post('/api/admin/users', requireSuperadmin, async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      // Generate a unique ID for manual users (prefix with 'manual_')
      const userId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const user = await storage.createUserManual({
        id: userId,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: parsed.data.role,
        defaultChannelId: parsed.data.defaultChannelId || null,
        notes: parsed.data.notes || null,
      });
      // Set assigned channels if provided
      if (parsed.data.channelIds) {
        await storage.setUserChannels(userId, parsed.data.channelIds);
      }
      // Return user with channels
      const channels = await storage.getUserChannels(userId);
      res.status(201).json({ ...user, channels });
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  // Update user details (superadmin only)
  const updateUserSchema = z.object({
    email: z.string().email("Valid email is required").optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.enum(["admin", "creative", "search"]).optional(),
    defaultChannelId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    channelIds: z.array(z.string()).optional(),
  });
  
  app.patch('/api/admin/users/:userId', requireSuperadmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { channelIds, ...userUpdates } = parsed.data;
      const updated = await storage.updateUserDetails(userId, userUpdates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      // Update assigned channels if provided
      if (channelIds !== undefined) {
        await storage.setUserChannels(userId, channelIds);
      }
      // Return user with channels
      const channels = await storage.getUserChannels(userId);
      res.json({ ...updated, channels });
    } catch (error: any) {
      console.error("Error updating user:", error);
      if (error.code === '23505') {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // Update user role (superadmin only)
  app.patch('/api/admin/users/:userId/role', requireSuperadmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (!['admin', 'creative', 'search'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Use: admin, creative, or search" });
      }
      const updated = await storage.updateUserRole(userId, role);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });
  
  // Update user's default channel (superadmin only - for creatives)
  app.patch('/api/admin/users/:userId/default-channel', requireSuperadmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { channelId } = req.body;
      const updated = await storage.updateUserDefaultChannel(userId, channelId || null);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating default channel:", error);
      res.status(500).json({ message: "Failed to update default channel" });
    }
  });
  
  // Delete user (superadmin only)
  app.delete('/api/admin/users/:userId', requireSuperadmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getUserId(req);
      // Prevent deleting yourself
      if (userId === currentUserId) {
        return res.status(400).json({ message: "You cannot delete yourself" });
      }
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  // Get all YouTube channels
  app.get('/api/admin/channels', requireAdmin, async (req, res) => {
    try {
      const channels = await storage.getAllChannels();
      res.json(channels);
    } catch (error) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });
  
  // Add a new YouTube channel (admin only)
  const createChannelSchema = z.object({
    id: z.string().min(1, "Channel ID is required"),
    name: z.string().min(1, "Channel name is required"),
  });
  
  app.post('/api/admin/channels', requireAdmin, async (req, res) => {
    try {
      const parsed = createChannelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const channel = await storage.createChannel(parsed.data);
      if (!channel) {
        return res.status(409).json({ message: "Channel with this ID already exists" });
      }
      res.status(201).json(channel);
    } catch (error) {
      console.error("Error creating channel:", error);
      res.status(500).json({ message: "Failed to create channel" });
    }
  });
  
  // Delete a YouTube channel (admin only)
  app.delete('/api/admin/channels/:channelId', requireAdmin, async (req, res) => {
    try {
      await storage.deleteChannel(req.params.channelId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting channel:", error);
      res.status(500).json({ message: "Failed to delete channel" });
    }
  });
  
  // Assign channel to user (superadmin only)
  const assignChannelSchema = z.object({
    channelId: z.string().min(1, "Channel ID is required"),
  });
  
  app.post('/api/admin/users/:userId/channels', requireSuperadmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const parsed = assignChannelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      // Verify channel exists
      const channel = await storage.getChannel(parsed.data.channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      await storage.assignUserChannel(userId, parsed.data.channelId);
      const channels = await storage.getUserChannels(userId);
      res.json(channels);
    } catch (error) {
      console.error("Error assigning channel:", error);
      res.status(500).json({ message: "Failed to assign channel" });
    }
  });
  
  // Remove channel from user (superadmin only)
  app.delete('/api/admin/users/:userId/channels/:channelId', requireSuperadmin, async (req, res) => {
    try {
      const { userId, channelId } = req.params;
      await storage.removeUserChannel(userId, channelId);
      const channels = await storage.getUserChannels(userId);
      res.json(channels);
    } catch (error) {
      console.error("Error removing channel:", error);
      res.status(500).json({ message: "Failed to remove channel" });
    }
  });
  
  // Get current user's channels (for publish dropdown - admins only)
  app.get('/api/my-channels', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const channels = await storage.getUserChannels(userId);
      res.json(channels);
    } catch (error) {
      console.error("Error fetching user channels:", error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });
  
  // Get current user's role and publish info
  app.get('/api/me/publish-info', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = await getUserFromDb(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const role = user.role as UserRole || 'search';
      const canPublish = role === 'superadmin' || role === 'admin' || role === 'creative';
      const showChannelSelector = role === 'superadmin' || role === 'admin';
      
      let channels: { id: string; name: string }[] = [];
      let defaultChannel: { id: string; name: string } | null = null;
      
      if (showChannelSelector) {
        // Superadmin and admin see ALL channels
        channels = await storage.getAllChannels();
      } else if (role === 'creative' && user.defaultChannelId) {
        const channel = await storage.getChannel(user.defaultChannelId);
        if (channel) {
          defaultChannel = { id: channel.id, name: channel.name };
        }
      }
      
      res.json({ role, canPublish, showChannelSelector, channels, defaultChannel });
    } catch (error) {
      console.error("Error fetching publish info:", error);
      res.status(500).json({ message: "Failed to fetch publish info" });
    }
  });
  
  // Seed initial YouTube channels (one-time setup)
  app.post('/api/admin/seed', requireAdmin, async (req, res) => {
    try {
      const initialChannels = [
        { id: "UCa586yWZnTTfLXtZNTa5vBw", name: "askstephenai" },
        { id: "UCVAGjWUUc-5TxtD8u_VSgvg", name: "Global Realtor 4a Cause" },
        { id: "UCrc-psIutcn0R-WJxQ2TBKw", name: "ZOE: Abundant Living" },
        { id: "UCvveL795n4PD_Z5mF-fvMoQ", name: "Patching2aHealthierYou!!" },
        { id: "UCyallR3vmWKVyGqCbQXfVbg", name: "Truth in Data" },
      ];
      
      const created = [];
      for (const ch of initialChannels) {
        const result = await storage.createChannel(ch);
        if (result) created.push(result);
      }
      
      res.json({ message: `Seeded ${created.length} channels`, channels: created });
    } catch (error) {
      console.error("Error seeding channels:", error);
      res.status(500).json({ message: "Failed to seed channels" });
    }
  });
  
  // Make vanwilson the superadmin (bootstrap endpoint - only works if no superadmin exists)
  app.post('/api/bootstrap-superadmin', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userEmail = req.auth?.claims?.email as string | undefined;
      
      // Only the designated owner can become superadmin - strict email match
      const SUPERADMIN_EMAIL = 'vfw4444@gmail.com';
      console.log("[Bootstrap] Attempting bootstrap for email:", userEmail);
      if (!userEmail || userEmail.toLowerCase() !== SUPERADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Check if any superadmin exists
      const allUsers = await storage.getAllUsers();
      const hasSuperadmin = allUsers.some(u => u.role === 'superadmin');
      
      if (hasSuperadmin) {
        return res.status(403).json({ message: "Superadmin already exists" });
      }
      
      // Make current user superadmin
      const updated = await storage.updateUserRole(userId, 'superadmin');
      res.json({ message: "You are now the superadmin", user: updated });
    } catch (error) {
      console.error("Error bootstrapping superadmin:", error);
      res.status(500).json({ message: "Failed to bootstrap superadmin" });
    }
  });

  // Export all admin data as CSV (superadmin only)
  app.get('/api/admin/export-csv', requireSuperadmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Get users with their channels (same pattern as /api/admin/users)
      const users = await Promise.all(
        allUsers.map(async (user) => ({
          ...user,
          channels: await storage.getUserChannels(user.id)
        }))
      );
      const channels = await storage.getAllChannels();
      
      // Build CSV content
      let csv = '';
      
      // Users section
      csv += '=== USERS ===\n';
      csv += 'ID,Email,First Name,Last Name,Role,Default Channel ID,Notes,Assigned Channels\n';
      for (const user of users) {
        const channelNames = user.channels?.map((c: any) => c.name).join('; ') || '';
        const escapeCsv = (val: string | null | undefined) => {
          if (!val) return '';
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        csv += `${escapeCsv(user.id)},${escapeCsv(user.email)},${escapeCsv(user.firstName)},${escapeCsv(user.lastName)},${escapeCsv(user.role)},${escapeCsv(user.defaultChannelId)},${escapeCsv(user.notes)},${escapeCsv(channelNames)}\n`;
      }
      
      csv += '\n=== CHANNELS ===\n';
      csv += 'Channel ID,Channel Name\n';
      for (const channel of channels) {
        const escapeCsv = (val: string | null | undefined) => {
          if (!val) return '';
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        csv += `${escapeCsv(channel.id)},${escapeCsv(channel.name)}\n`;
      }
      
      // Set headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="admin-export-${timestamp}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // ===================
  // WORKBOOK ROUTES
  // ===================
  
  // Middleware to check for pickone role access
  const requirePickoneRole = async (req: any, res: any, next: any) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const user = await getUserFromDb(userId);
      if (!user || user.role !== "pickone") {
        return res.status(403).json({ message: "Access denied. Workbook is only available for Pick One users." });
      }
      next();
    } catch (error) {
      console.error("Error checking pickone role:", error);
      res.status(500).json({ message: "Failed to verify access" });
    }
  };

  // Get workbook progress for current user
  app.get('/api/workbook/progress', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const progress = await storage.getWorkbookProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching workbook progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Create or update workbook progress
  app.post('/api/workbook/progress', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const progress = await storage.upsertWorkbookProgress(userId, req.body);
      res.json(progress);
    } catch (error) {
      console.error("Error saving workbook progress:", error);
      res.status(500).json({ message: "Failed to save progress" });
    }
  });

  // Get core value for current user
  app.get('/api/workbook/core-value', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const coreValue = await storage.getCoreValue(userId);
      res.json(coreValue);
    } catch (error) {
      console.error("Error fetching core value:", error);
      res.status(500).json({ message: "Failed to fetch core value" });
    }
  });

  // Save core value
  app.post('/api/workbook/core-value', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const coreValue = await storage.upsertCoreValue(userId, req.body);
      res.json(coreValue);
    } catch (error) {
      console.error("Error saving core value:", error);
      res.status(500).json({ message: "Failed to save core value" });
    }
  });

  // Get SWOT analysis for current user
  app.get('/api/workbook/swot', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const businessArea = req.query.businessArea as string || 'overall';
      const swot = await storage.getSwotAnalysis(userId, businessArea);
      res.json(swot);
    } catch (error) {
      console.error("Error fetching SWOT:", error);
      res.status(500).json({ message: "Failed to fetch SWOT" });
    }
  });

  // Get all SWOT analyses for current user
  app.get('/api/workbook/swot/all', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const swots = await storage.getAllSwotAnalyses(userId);
      res.json(swots);
    } catch (error) {
      console.error("Error fetching all SWOTs:", error);
      res.status(500).json({ message: "Failed to fetch SWOTs" });
    }
  });

  // Save SWOT analysis
  app.post('/api/workbook/swot', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const swot = await storage.upsertSwotAnalysis(userId, req.body);
      res.json(swot);
    } catch (error) {
      console.error("Error saving SWOT:", error);
      res.status(500).json({ message: "Failed to save SWOT" });
    }
  });

  // Get root cause chart for current user
  app.get('/api/workbook/root-cause', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const rootCause = await storage.getRootCauseChart(userId);
      res.json(rootCause);
    } catch (error) {
      console.error("Error fetching root cause:", error);
      res.status(500).json({ message: "Failed to fetch root cause" });
    }
  });

  // Save root cause chart
  app.post('/api/workbook/root-cause', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const rootCause = await storage.upsertRootCauseChart(userId, req.body);
      res.json(rootCause);
    } catch (error) {
      console.error("Error saving root cause:", error);
      res.status(500).json({ message: "Failed to save root cause" });
    }
  });

  // Get time audit for current user
  app.get('/api/workbook/time-audit', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const timeAudit = await storage.getTimeAudit(userId);
      res.json(timeAudit);
    } catch (error) {
      console.error("Error fetching time audit:", error);
      res.status(500).json({ message: "Failed to fetch time audit" });
    }
  });

  // Save time audit
  app.post('/api/workbook/time-audit', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const timeAudit = await storage.upsertTimeAudit(userId, req.body);
      res.json(timeAudit);
    } catch (error) {
      console.error("Error saving time audit:", error);
      res.status(500).json({ message: "Failed to save time audit" });
    }
  });

  // Get action plan for current user
  app.get('/api/workbook/action-plan', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const actionPlan = await storage.getActionPlan(userId);
      res.json(actionPlan);
    } catch (error) {
      console.error("Error fetching action plan:", error);
      res.status(500).json({ message: "Failed to fetch action plan" });
    }
  });

  // Save action plan
  app.post('/api/workbook/action-plan', requirePickoneRole, async (req: any, res) => {
    try {
      const userId = getUserId(req)!
      const actionPlan = await storage.upsertActionPlan(userId, req.body);
      res.json(actionPlan);
    } catch (error) {
      console.error("Error saving action plan:", error);
      res.status(500).json({ message: "Failed to save action plan" });
    }
  });

  // AI Coach endpoint
  app.post('/api/workbook/ai-coach', requirePickoneRole, async (req: any, res) => {
    try {
      const { section, action, currentAnswers, message } = req.body;
      const response = await getAICoachResponse(section, action, currentAnswers, message);
      res.json(response);
    } catch (error) {
      console.error("Error with AI coach:", error);
      res.status(500).json({ message: "AI coach unavailable" });
    }
  });

  // ===================
  // DROPBOX ROUTES
  // ===================
  
  // Integration: connection:conn_dropbox_01KE9PFV0VB4NCY65BHVMTKAXE
  const { listDropboxFiles, getDropboxAccountInfo, isDropboxConnected, getDropboxFileTemporaryLink } = await import('./cloud-providers/dropbox');
  
  // Check Dropbox connection status
  app.get('/api/dropbox/status', async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const connected = await isDropboxConnected();
      if (connected) {
        const accountInfo = await getDropboxAccountInfo();
        res.json({ connected: true, account: accountInfo });
      } else {
        res.json({ connected: false });
      }
    } catch (error) {
      console.error("Error checking Dropbox status:", error);
      res.json({ connected: false });
    }
  });
  
  // List Dropbox files in a folder
  app.get('/api/dropbox/files', async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const path = (req.query.path as string) || '';
      const files = await listDropboxFiles(path);
      res.json(files);
    } catch (error) {
      console.error("Error listing Dropbox files:", error);
      res.status(500).json({ message: "Failed to list files" });
    }
  });
  
  // Get temporary download link for a file
  app.get('/api/dropbox/download-link', async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ message: "Path is required" });
      const link = await getDropboxFileTemporaryLink(filePath);
      res.json({ link });
    } catch (error) {
      console.error("Error getting download link:", error);
      res.status(500).json({ message: "Failed to get download link" });
    }
  });
  
  // Save Dropbox connection for a user
  app.post('/api/dropbox/connect', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const accountInfo = await getDropboxAccountInfo();
      
      const connection = await storage.upsertCloudConnection(userId, 'dropbox', {
        accountId: accountInfo.accountId,
        accountName: accountInfo.name,
        accountEmail: accountInfo.email,
        profilePhotoUrl: accountInfo.profilePhotoUrl,
        isActive: 'true',
        lastSyncedAt: new Date(),
      });
      
      res.json(connection);
    } catch (error) {
      console.error("Error saving Dropbox connection:", error);
      res.status(500).json({ message: "Failed to save connection" });
    }
  });
  
  // Set selected folder for Dropbox
  app.post('/api/dropbox/select-folder', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { folderPath, folderName } = req.body;
      
      const connection = await storage.upsertCloudConnection(userId, 'dropbox', {
        selectedFolderPath: folderPath,
        selectedFolderName: folderName,
        lastSyncedAt: new Date(),
      });
      
      res.json(connection);
    } catch (error) {
      console.error("Error setting folder:", error);
      res.status(500).json({ message: "Failed to set folder" });
    }
  });
  
  // Get user's cloud connections
  app.get('/api/cloud-connections', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const connections = await storage.getAllCloudConnections(userId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching cloud connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });
  
  // Search for video files recursively in Dropbox
  const { searchDropboxVideosRecursive } = await import('./cloud-providers/dropbox');
  
  app.get('/api/dropbox/search-videos', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      
      // Check user has connection
      const connection = await storage.getCloudConnection(userId, 'dropbox');
      if (!connection || connection.isActive !== 'true') {
        return res.status(403).json({ message: "Dropbox not connected. Please connect your account first." });
      }
      
      const basePath = (req.query.path as string) || connection.selectedFolderPath || '';
      const videos = await searchDropboxVideosRecursive(basePath);
      res.json(videos);
    } catch (error) {
      console.error("Error searching Dropbox videos:", error);
      res.status(500).json({ message: "Failed to search videos" });
    }
  });
  
  // ===================
  // VIDEO INGEST REQUESTS
  // ===================
  
  // Create ingest requests for selected videos
  app.post('/api/ingest-requests', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { videos, provider = 'dropbox' } = req.body;
      
      if (!videos || !Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({ message: "No videos selected" });
      }
      
      const requests = videos.map((video: any) => ({
        userId,
        provider,
        sourcePath: video.path,
        sourceFileName: video.name,
        sourceFileSize: video.size,
        status: 'queued' as const,
      }));
      
      const created = await storage.createVideoIngestRequests(requests);
      res.json(created);
    } catch (error) {
      console.error("Error creating ingest requests:", error);
      res.status(500).json({ message: "Failed to create ingest requests" });
    }
  });
  
  // Get user's ingest requests
  app.get('/api/ingest-requests', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const requests = await storage.getVideoIngestRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching ingest requests:", error);
      res.status(500).json({ message: "Failed to fetch ingest requests" });
    }
  });
  
  // Get single ingest request
  app.get('/api/ingest-requests/:id', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseInt(req.params.id);
      
      const request = await storage.getVideoIngestRequest(id);
      if (!request || request.userId !== userId) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error fetching ingest request:", error);
      res.status(500).json({ message: "Failed to fetch ingest request" });
    }
  });
  
  // Cancel ingest request
  app.delete('/api/ingest-requests/:id', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseInt(req.params.id);
      
      const request = await storage.getVideoIngestRequest(id);
      if (!request || request.userId !== userId) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      if (request.status !== 'queued') {
        return res.status(400).json({ message: "Can only cancel queued requests" });
      }
      
      await storage.cancelVideoIngestRequest(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling ingest request:", error);
      res.status(500).json({ message: "Failed to cancel ingest request" });
    }
  });

  // ========== SEMANTIC SEARCH ROUTES ==========
  
  // Search videos using AI semantic analysis
  app.post("/api/search", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { query, limit = 10 } = req.body;
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ message: "Query is required" });
      }
      
      // Get all videos with transcripts
      const allVideos = await storage.getPublishedVideosWithTranscripts();
      
      if (allVideos.length === 0) {
        return res.json({ 
          success: true, 
          query: query.trim(), 
          results: [], 
          totalFound: 0,
          message: "No videos with transcripts available for search"
        });
      }
      
      // Score videos using AI
      const scoredResults = await Promise.all(
        allVideos.map(async (video) => {
          try {
            const transcriptPreview = (video.transcript || '').substring(0, 3000);
            
            const completion = await openaiClient.chat.completions.create({
              model: "gpt-4o",
              messages: [
                { 
                  role: "system", 
                  content: `You are a video content analyzer. Rate how well this video answers the user's question. Return JSON with:
                  - relevanceScore: number 0-100 (how relevant is this video to the query)
                  - relevantSegments: array of {startTime: number (seconds), endTime: number (seconds), reason: string}
                  - matchSummary: string (brief explanation of why this video is or isn't relevant)`
                },
                { 
                  role: "user", 
                  content: `User Question: "${query}"
                  
Video Title: ${video.title || video.originalFilename}
Video Transcript (excerpt):
${transcriptPreview}

Analyze this video's relevance to the user's question.`
                }
              ],
              response_format: { type: "json_object" }
            });
            
            const content = completion.choices[0].message.content;
            if (!content) throw new Error("No response from AI");
            
            let analysis;
            try {
              analysis = JSON.parse(content);
            } catch (parseErr) {
              console.error(`Failed to parse AI response for video ${video.id}:`, content);
              return null;
            }
            
            const relevanceScore = Math.min(100, Math.max(0, 
              typeof analysis.relevanceScore === 'number' ? analysis.relevanceScore :
              typeof analysis.relevance_score === 'number' ? analysis.relevance_score : 0
            ));
            
            const matchSummary = analysis.matchSummary || analysis.summary || analysis.match_summary || '';
            
            const rawSegments = analysis.relevantSegments || analysis.relevant_segments || [];
            const relevantSegments = Array.isArray(rawSegments) ? rawSegments.map((seg: any) => ({
              startTime: typeof seg.startTime === 'number' ? seg.startTime : 
                         typeof seg.start_time === 'number' ? seg.start_time : 0,
              endTime: typeof seg.endTime === 'number' ? seg.endTime : 
                       typeof seg.end_time === 'number' ? seg.end_time : 0,
              reason: seg.reason || ''
            })) : [];
            
            return {
              videoId: video.id,
              videoTitle: video.title || video.originalFilename || 'Untitled',
              thumbnailUrl: video.thumbnailUrl || null,
              youtubeId: video.youtubeId || null,
              relevanceScore,
              matchSummary,
              relevantSegments
            };
          } catch (error) {
            console.error(`Error analyzing video ${video.id}:`, error);
            return null;
          }
        })
      );
      
      const validResults = scoredResults
        .filter((r): r is NonNullable<typeof r> => r !== null && r.relevanceScore > 20)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
      
      await storage.saveSearchQuery({
        userId,
        query: query.trim(),
        results: validResults,
        totalFound: validResults.length
      });
      
      res.json({
        success: true,
        query: query.trim(),
        results: validResults,
        totalFound: validResults.length
      });
      
    } catch (error: any) {
      console.error("Semantic search error:", error);
      res.status(500).json({ message: "Search failed", error: error.message });
    }
  });
  
  // Get recent search history
  app.get("/api/search/history", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const history = await storage.getRecentSearches(userId, limit);
      res.json(history);
    } catch (error: any) {
      console.error("Search history error:", error);
      res.status(500).json({ message: "Failed to get search history" });
    }
  });

  // ========== LOCAL LEADS ROUTES ==========
  
  // Get all client businesses
  app.get('/api/leads/clients', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const clients = await storage.getClientBusinesses(userId);
      res.json(clients);
    } catch (error: any) {
      console.error("Error fetching client businesses:", error);
      res.status(500).json({ message: error.message || "Failed to fetch client businesses" });
    }
  });
  
  // Create client business
  app.post('/api/leads/clients', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const client = await storage.createClientBusiness({ ...req.body, userId });
      res.json(client);
    } catch (error: any) {
      console.error("Error creating client business:", error);
      res.status(500).json({ message: error.message || "Failed to create client business" });
    }
  });
  
  // Delete client business
  app.delete('/api/leads/clients/:id', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientBusiness(id);
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client business not found" });
      }
      await storage.deleteClientBusiness(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting client business:", error);
      res.status(500).json({ message: error.message || "Failed to delete client business" });
    }
  });
  
  // Get SWOT analyses for a client
  app.get('/api/leads/clients/:id/swot', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const clientId = parseInt(req.params.id);
      const client = await storage.getClientBusiness(clientId);
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client business not found" });
      }
      const analyses = await storage.getSwotAnalysesForClient(clientId);
      res.json(analyses);
    } catch (error: any) {
      console.error("Error fetching SWOT analyses:", error);
      res.status(500).json({ message: error.message || "Failed to fetch SWOT analyses" });
    }
  });
  
  // Generate SWOT analysis for a client
  app.post('/api/leads/clients/:id/swot', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const clientId = parseInt(req.params.id);
      const client = await storage.getClientBusiness(clientId);
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client business not found" });
      }
      
      // Create pending analysis
      const analysis = await storage.createLeadsSwotAnalysis({
        clientBusinessId: clientId,
        userId,
        status: "generating",
      });
      
      // Generate with AI (simplified for now)
      try {
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a business analyst helping generate SWOT analyses for local businesses based on their market position and competitors."
            },
            {
              role: "user",
              content: `Generate a SWOT analysis for ${client.name}, a ${client.keyword} business located at ${client.address}. Business type: ${client.businessType}. Return JSON with: strengths, weaknesses, opportunities, threats arrays (each item has text, source, confidence fields), and a summary.`
            }
          ],
          response_format: { type: "json_object" },
        });
        
        const result = JSON.parse(completion.choices[0].message.content || "{}");
        const updated = await storage.updateLeadsSwotAnalysis(analysis.id, {
          strengths: result.strengths || [],
          weaknesses: result.weaknesses || [],
          opportunities: result.opportunities || [],
          threats: result.threats || [],
          summary: result.summary || "",
          status: "completed",
          modelUsed: "gpt-4o-mini",
        });
        
        res.json(updated);
      } catch (aiError: any) {
        await storage.updateLeadsSwotAnalysis(analysis.id, {
          status: "error",
          errorMessage: aiError.message,
        });
        throw aiError;
      }
    } catch (error: any) {
      console.error("Error generating SWOT analysis:", error);
      res.status(500).json({ message: error.message || "Failed to generate SWOT analysis" });
    }
  });

  // Get lead searches for a client
  app.get('/api/leads/clients/:id/searches', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const clientId = parseInt(req.params.id);
    try {
      
      const client = await storage.getClientBusiness(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client business not found" });
      }
      if (client.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const searches = await storage.getLeadSearches(clientId);
      res.json(searches);
    } catch (error: any) {
      console.error("[Leads] Error fetching searches:", error.message);
      res.status(500).json({ message: "Failed to fetch lead searches" });
    }
  });

  // Trigger a new lead search for a client business
  app.post('/api/leads/clients/:id/search', isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const clientId = parseInt(req.params.id);
    try {
      
      const client = await storage.getClientBusiness(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client business not found" });
      }
      if (client.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Validate and parse search options from request body
      const searchOptionsSchema = z.object({
        searchTypes: z.array(z.enum(["ideal_customer", "competitor", "partner"])).min(1).default(["ideal_customer", "competitor", "partner"]),
        verifyEmails: z.boolean().default(false),
      });
      
      const parseResult = searchOptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid search options", errors: parseResult.error.errors });
      }
      
      const { searchTypes, verifyEmails } = parseResult.data;
      console.log(`[Leads] Search options: types=${searchTypes.join(',')}, verifyEmails=${verifyEmails}`);
      
      // Import and execute the lead search
      const { executeLeadSearch } = await import("./schedulers/leadsScheduler");
      const result = await executeLeadSearch(clientId, userId, searchTypes, verifyEmails, 'manual');
      
      res.json({ 
        message: "Search started", 
        searchId: result.searchId, 
        status: result.status 
      });
    } catch (error: any) {
      console.error("[Leads] Error starting search:", error.message);
      res.status(500).json({ message: error.message || "Failed to start lead search" });
    }
  });

  // Callback endpoint for n8n to send lead search results
  // This is a public endpoint (no auth) since n8n calls it
  app.post('/api/leads/webhook/results', async (req, res) => {
    try {
      console.log(`[Leads Webhook] Received callback:`, JSON.stringify(req.body).slice(0, 500));
      
      const { search_id, results, error } = req.body;
      
      if (!search_id) {
        return res.status(400).json({ message: "Missing search_id" });
      }
      
      // Extract numeric ID from "search-123" format
      const searchIdNum = typeof search_id === 'string' && search_id.startsWith('search-') 
        ? parseInt(search_id.replace('search-', ''))
        : parseInt(search_id);
      
      if (isNaN(searchIdNum)) {
        return res.status(400).json({ message: "Invalid search_id format" });
      }
      
      // Import the mapping function
      const { mapN8nResults } = await import("./schedulers/leadsScheduler");
      
      if (error) {
        await storage.updateLeadSearch(searchIdNum, {
          status: "error",
          errorMessage: error,
        } as any);
        console.log(`[Leads Webhook] Search ${searchIdNum} marked as error: ${error}`);
      } else if (results && Array.isArray(results)) {
        const mappedResults = mapN8nResults(results);
        await storage.updateLeadSearch(searchIdNum, {
          status: "completed",
          results: mappedResults,
          totalFound: mappedResults.length,
        } as any);
        console.log(`[Leads Webhook] Search ${searchIdNum} completed with ${mappedResults.length} results`);
      } else {
        console.log(`[Leads Webhook] Search ${searchIdNum} received empty or invalid results`);
      }
      
      res.json({ success: true, search_id: searchIdNum });
    } catch (error: any) {
      console.error("[Leads Webhook] Error processing callback:", error.message);
      res.status(500).json({ message: error.message || "Failed to process webhook callback" });
    }
  });

  // ===========================================
  // BUSINESS INTELLIGENCE ROUTES (n8n integration)
  // ===========================================

  // Callback endpoint for n8n to send BI results (public - no auth)
  app.post('/api/intel/callback', async (req, res) => {
    try {
      console.log('[BI Callback] Received:', JSON.stringify(req.body).slice(0, 500));
      
      const { storeIntelResults } = await import("./services/businessIntelligence");
      await storeIntelResults(req.body);
      
      res.json({ received: true });
    } catch (error: any) {
      console.error('[BI Callback] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger business intelligence analysis (requires auth)
  app.post('/api/intel/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const { requestBusinessIntelligence } = await import("./services/businessIntelligence");
      
      const {
        clientBusinessId,
        businessType,
        businessName,
        geo,
        placeId,
        competitors,
        actions
      } = req.body;

      if (!clientBusinessId || !businessType || !businessName || !geo || !actions) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const result = await requestBusinessIntelligence({
        clientBusinessId,
        businessType,
        businessName,
        geo,
        placeId,
        competitors: competitors || [],
        actions
      });

      res.json(result);
    } catch (error: any) {
      console.error('[BI Analyze] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get stored BI results for a client business
  app.get('/api/intel/results/:clientBusinessId', isAuthenticated, async (req: any, res) => {
    try {
      const { clientBusinessId } = req.params;
      const { type } = req.query;

      const { getIntelResults } = await import("./services/businessIntelligence");
      const results = await getIntelResults(Number(clientBusinessId), type as string);

      res.json(results);
    } catch (error: any) {
      console.error('[BI Results] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

// AI Coach helper function
async function getAICoachResponse(
  section: string, 
  action: string, 
  currentAnswers: any, 
  message?: string
): Promise<any> {
  const systemPrompts: Record<string, string> = {
    'core-value': `You are an AI business coach helping someone discover their core business value. 
Be encouraging but push them to go deeper. Ask clarifying questions. 
Reference their previous answers when giving suggestions.`,
    'swot': `You are an AI business coach helping with SWOT analysis.
Help identify patterns across strengths, weaknesses, opportunities, and threats.
Suggest items they may have missed based on their industry.`,
    'root-cause': `You are an AI coach guiding someone through root cause analysis using the 5 Whys technique.
Help them dig deeper to find the true root cause, not just symptoms.
Ask probing questions that challenge surface-level answers.`,
    'time-audit': `You are an AI coach helping with time management.
Help identify low-value tasks that can be delegated or eliminated.
Calculate the true cost of time spent on various activities.`,
    'action-plan': `You are an AI coach helping create a focused 90-day action plan.
Help prioritize tasks and set realistic milestones.
Ensure the plan aligns with their core value and addresses root causes.`
  };

  const prompt = systemPrompts[section] || systemPrompts['core-value'];
  
  try {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt },
        { 
          role: "user", 
          content: `Action: ${action}\nCurrent Answers: ${JSON.stringify(currentAnswers)}\n${message ? `User Message: ${message}` : ''}`
        }
      ],
      max_tokens: 500
    });

    return {
      response: completion.choices[0]?.message?.content || "I'm here to help. What would you like to explore?",
      suggestions: []
    };
  } catch (error) {
    console.error("AI Coach error:", error);
    return {
      response: "I'm having trouble connecting right now. Please try again.",
      suggestions: []
    };
  }
}

// --- Background Processors ---

// Helper to get video duration using ffprobe
async function getVideoDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const durationSec = parseFloat(stdout.trim());
    return isNaN(durationSec) ? null : Math.floor(durationSec * 1000); // Convert to ms
  } catch (err) {
    console.error("ffprobe duration error:", err);
    return null;
  }
}

async function processVideo(videoId: number, publicUrl: string) {
    try {
        // Get the video record to access the file path
        const videoRecord = await storage.getVideo(videoId);
        if (!videoRecord) throw new Error("Video not found");
        
        // Capture duration using ffprobe
        const durationMs = await getVideoDuration(videoRecord.storagePath);
        if (durationMs) {
          await storage.updateVideo(videoId, { durationMs });
          console.log(`[ffprobe] Video duration: ${durationMs}ms`);
        }
        
        await storage.updateVideo(videoId, { status: "transcribing" });
        console.log(`Sending video to transcription API: ${publicUrl}`);

        const params = new URLSearchParams();
        params.append('video_url', publicUrl);
        params.append('language_code', 'en');

        const response = await axios.post('http://72.60.225.136:8001/transcribe', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 300000 
        });

        const { text, srt } = response.data || {};
        const transcript = srt || text;
        
        if (!transcript) {
            throw new Error("No transcript returned from API");
        }

        await storage.updateVideo(videoId, {
            status: "ready_to_edit",
            transcript: transcript,
        });
        
        await generateMetadata(videoId, transcript);

    } catch (error) {
        console.error("Processing error:", error);
        await storage.updateVideo(videoId, { status: "failed" });
    }
}

async function generateMetadata(videoId: number, transcript: string) {
    try {
        const completion = await openaiClient.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                { role: "system", content: "You are a YouTube expert. Generate metadata based on the transcript provided. Return JSON." },
                { role: "user", content: `Transcript: ${transcript.substring(0, 5000)}... \n\nGenerate JSON with: 
                - title (less than 60 characters)
                - description (less than 1000 characters)
                - tags (comma separated string)
                - thumbnail_prompt (for DALL-E)
                ` }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (content) {
            const metadata = JSON.parse(content);
            await storage.updateVideo(videoId, {
                title: metadata.title,
                description: metadata.description,
                tags: Array.isArray(metadata.tags) ? metadata.tags.join(', ') : metadata.tags,
                thumbnailPrompt: metadata.thumbnail_prompt,
                status: "ready_to_edit"
            });
        }
    } catch (error) {
        console.error("Metadata generation error:", error);
        await storage.updateVideo(videoId, { status: "ready_to_edit" }); // Fallback
    }
}

import FormData from "form-data";

// Helper to convert milliseconds to ffmpeg time format (HH:MM:SS.mmm)
function msToFfmpegTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// Helper to adjust SRT captions based on trim offset
function adjustCaptions(srt: string, trimStartMs: number): string {
  // Parse SRT format and adjust timestamps
  const lines = srt.split('\n');
  const adjustedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if this is a timestamp line (format: 00:00:00,000 --> 00:00:00,000)
    const timestampMatch = line.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    
    if (timestampMatch) {
      // Parse start and end times
      const startMs = parseInt(timestampMatch[1]) * 3600000 + parseInt(timestampMatch[2]) * 60000 + 
                      parseInt(timestampMatch[3]) * 1000 + parseInt(timestampMatch[4]);
      const endMs = parseInt(timestampMatch[5]) * 3600000 + parseInt(timestampMatch[6]) * 60000 + 
                    parseInt(timestampMatch[7]) * 1000 + parseInt(timestampMatch[8]);
      
      // Adjust by offset - skip captions before trim start
      const newStartMs = startMs - trimStartMs;
      const newEndMs = endMs - trimStartMs;
      
      if (newEndMs <= 0) {
        // Skip captions that end before the trim start
        // Also skip the subtitle number and text lines
        i += 2; // Skip text line and blank line
        continue;
      }
      
      // Format new timestamps
      const formatTime = (ms: number) => {
        const h = Math.floor(Math.max(0, ms) / 3600000);
        const m = Math.floor((Math.max(0, ms) % 3600000) / 60000);
        const s = Math.floor((Math.max(0, ms) % 60000) / 1000);
        const msec = Math.max(0, ms) % 1000;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${msec.toString().padStart(3, '0')}`;
      };
      
      adjustedLines.push(`${formatTime(Math.max(0, newStartMs))} --> ${formatTime(newEndMs)}`);
    } else {
      adjustedLines.push(line);
    }
  }
  
  return adjustedLines.join('\n');
}

// Helper to trim video using ffmpeg
async function trimVideo(inputPath: string, outputPath: string, startMs: number, endMs?: number): Promise<void> {
  const startTime = msToFfmpegTime(startMs);
  let cmd = `ffmpeg -y -ss ${startTime} -i "${inputPath}"`;
  
  if (endMs !== undefined && endMs !== null) {
    const durationMs = endMs - startMs;
    const duration = msToFfmpegTime(durationMs);
    cmd += ` -t ${duration}`;
  }
  
  cmd += ` -c copy "${outputPath}"`;
  
  console.log(`[ffmpeg] Trimming video: ${cmd}`);
  await execAsync(cmd);
}

async function publishToYouTube(videoId: number, video: any, channelId?: string) {
    try {
        console.log(`[YouTube Publish] Starting for video ${videoId}${channelId ? ` on channel ${channelId}` : ''}`);
        console.log(`[YouTube Publish] Video data:`, {
          storagePath: video.storagePath,
          title: video.title?.substring(0, 50),
          thumbnailUrl: video.thumbnailUrl,
          hasTranscript: !!video.transcript,
          trimStartMs: video.trimStartMs,
          trimEndMs: video.trimEndMs
        });

        // Determine the video file to upload (original or trimmed)
        let videoFileToUpload = video.storagePath;
        let trimmedFilePath: string | null = null;
        
        // If trim times are set, create a trimmed version
        if (video.trimStartMs !== null && video.trimStartMs !== undefined && video.trimStartMs > 0) {
          const ext = path.extname(video.storagePath);
          trimmedFilePath = path.join('uploads', `trimmed_${videoId}_${Date.now()}${ext}`);
          
          try {
            await trimVideo(video.storagePath, trimmedFilePath, video.trimStartMs, video.trimEndMs);
            videoFileToUpload = trimmedFilePath;
            console.log(`[YouTube Publish] Using trimmed video: ${trimmedFilePath}`);
          } catch (trimErr) {
            console.error("[YouTube Publish] Trim failed, using original:", trimErr);
            // Fall back to original if trimming fails
          }
        }

        const formData = new FormData();
        
        // Required fields per API spec
        formData.append('video', fs.createReadStream(videoFileToUpload));
        formData.append('title', video.title);
        formData.append('channel_id', channelId || 'UCa586yWZnTTfLXtZNTa5vBw'); // Default to askstephenai
        
        // Optional fields
        formData.append('description', video.description || '');
        formData.append('tags', video.tags || '');
        formData.append('privacy', video.privacyStatus || 'public');

        // Optional Thumbnail
        if (video.thumbnailUrl) {
            try {
                // If it's a local file URL
                if (video.thumbnailUrl.includes('/uploads/')) {
                    const fileName = path.basename(video.thumbnailUrl);
                    const filePath = path.join('uploads', fileName);
                    if (fs.existsSync(filePath)) {
                        formData.append('thumbnail', fs.createReadStream(filePath));
                    }
                } else {
                    // It's an external URL (unlikely for gpt-image-1 base64 path, but for robustness)
                    const thumbRes = await axios.get(video.thumbnailUrl, { responseType: 'stream' });
                    formData.append('thumbnail', thumbRes.data);
                }
            } catch (err) {
                console.warn("[YouTube Publish] Failed to attach thumbnail", err);
            }
        }

        // Optional Captions (VTT) - adjust timestamps if video was trimmed
        if (video.transcript) {
             let captions = video.transcript;
             
             // Adjust caption timestamps if trimmed
             if (video.trimStartMs !== null && video.trimStartMs !== undefined && video.trimStartMs > 0) {
               captions = adjustCaptions(captions, video.trimStartMs);
               console.log(`[YouTube Publish] Adjusted captions by ${video.trimStartMs}ms offset`);
             }
             
             const captionsBuffer = Buffer.from(captions);
             formData.append('english_captions', captionsBuffer, {
                 filename: 'captions.vtt',
                 contentType: 'text/vtt'
             });
        }

        const response = await axios.post('https://youtube-api.aiautomationauthority.com/upload/complete', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 600000 // 10 minutes
        });

        const result = response.data;
        if (result.success) {
            await storage.updateVideo(videoId, {
                status: "published",
                youtubeId: result.video_id,
                youtubeUrl: result.url
            });
            console.log(`[YouTube Publish] Success: ${result.url}`);
            
            // Clean up trimmed file if it was created
            if (trimmedFilePath && fs.existsSync(trimmedFilePath)) {
              try {
                fs.unlinkSync(trimmedFilePath);
                console.log(`[YouTube Publish] Cleaned up trimmed file: ${trimmedFilePath}`);
              } catch (cleanupErr) {
                console.warn("[YouTube Publish] Failed to cleanup trimmed file:", cleanupErr);
              }
            }
        } else {
            throw new Error(result.message || "Upload failed");
        }
    } catch (error: any) {
        console.error("[YouTube Publish] Error:", error.response?.data || error.message);
        throw error;
    }
}
