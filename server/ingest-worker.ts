import { storage } from "./storage";
import { downloadDropboxFileToPath, getDropboxFileTemporaryLink } from "./cloud-providers/dropbox";
import path from "path";
import fs from "fs";
import axios from "axios";
import OpenAI from "openai";

const openaiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

let isProcessing = false;

export async function startIngestWorker() {
  console.log("[IngestWorker] Starting background ingest worker...");
  
  setInterval(async () => {
    if (isProcessing) return;
    
    try {
      await processNextIngestRequest();
    } catch (error) {
      console.error("[IngestWorker] Error processing request:", error);
    }
  }, 5000);
}

async function processNextIngestRequest() {
  const request = await storage.getNextQueuedRequest();
  if (!request) return;
  
  isProcessing = true;
  console.log(`[IngestWorker] Processing ingest request ${request.id}: ${request.sourceFileName}`);
  
  try {
    await storage.updateVideoIngestRequest(request.id, { 
      status: 'downloading',
      startedAt: new Date(),
    });
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const safeFileName = `ingest_${request.id}_${Date.now()}_${request.sourceFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const localPath = path.join(uploadsDir, safeFileName);
    
    if (request.provider === 'dropbox') {
      const tempLink = await getDropboxFileTemporaryLink(request.sourcePath);
      console.log(`[IngestWorker] Downloading from Dropbox: ${request.sourcePath}`);
      
      const response = await axios({
        method: 'GET',
        url: tempLink,
        responseType: 'arraybuffer',
        timeout: 600000,
      });
      
      fs.writeFileSync(localPath, response.data);
      console.log(`[IngestWorker] Downloaded to: ${localPath}`);
    } else {
      throw new Error(`Unsupported provider: ${request.provider}`);
    }
    
    await storage.updateVideoIngestRequest(request.id, { 
      status: 'processing',
      downloadedPath: localPath,
    });
    
    const video = await storage.createVideo({
      userId: request.userId,
      originalFilename: request.sourceFileName,
      storagePath: localPath,
      title: request.sourceFileName.replace(/\.[^/.]+$/, ""),
      status: "uploading",
    });
    
    await storage.updateVideoIngestRequest(request.id, { 
      videoId: video.id,
    });
    
    await processImportedVideo(video.id, localPath, request.id);
    
  } catch (error: any) {
    console.error(`[IngestWorker] Failed to process request ${request.id}:`, error);
    await storage.updateVideoIngestRequest(request.id, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
      completedAt: new Date(),
    });
  } finally {
    isProcessing = false;
  }
}

async function processImportedVideo(videoId: number, localPath: string, ingestRequestId: number) {
  try {
    await storage.updateVideoIngestRequest(ingestRequestId, { status: 'transcribing' });
    await storage.updateVideo(videoId, { status: "transcribing" });
    
    const protocol = process.env.REPLIT_DEV_DOMAIN ? 'https' : 'http';
    const host = process.env.REPLIT_DEV_DOMAIN || `localhost:${process.env.PORT || 5000}`;
    const publicUrl = `${protocol}://${host}/uploads/${path.basename(localPath)}`;
    
    console.log(`[IngestWorker] Sending to transcription: ${publicUrl}`);
    
    const params = new URLSearchParams();
    params.append('video_url', publicUrl);
    params.append('language_code', 'en');

    const response = await axios.post('http://72.60.225.136:8001/transcribe', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 300000,
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
    
    await storage.updateVideoIngestRequest(ingestRequestId, {
      status: 'ready',
      completedAt: new Date(),
    });
    
    console.log(`[IngestWorker] Completed processing video ${videoId} from ingest request ${ingestRequestId}`);

  } catch (error: any) {
    console.error(`[IngestWorker] Processing error for video ${videoId}:`, error);
    await storage.updateVideo(videoId, { status: "failed" });
    await storage.updateVideoIngestRequest(ingestRequestId, {
      status: 'failed',
      errorMessage: error.message || 'Processing failed',
      completedAt: new Date(),
    });
  }
}

async function generateMetadata(videoId: number, transcript: string) {
  try {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a YouTube expert. Generate metadata based on the transcript provided. Return JSON." },
        { 
          role: "user", 
          content: `Transcript: ${transcript.substring(0, 5000)}... \n\nGenerate JSON with: 
          - title (less than 60 characters)
          - description (less than 1000 characters)
          - tags (comma separated string)` 
        }
      ],
      max_tokens: 1000
    });

    const content = completion.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const metadata = JSON.parse(jsonMatch[0]);
      await storage.updateVideo(videoId, {
        title: metadata.title || undefined,
        description: metadata.description || undefined,
        tags: metadata.tags || undefined,
      });
    }
  } catch (error) {
    console.error("[IngestWorker] Metadata generation error:", error);
  }
}
