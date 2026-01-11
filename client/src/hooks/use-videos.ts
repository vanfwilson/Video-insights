import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type Video, type InsertVideo } from "@shared/schema";

// Helper to log Zod errors
function parseWithLogging<T>(schema: any, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    // For now return data anyway to prevent crash, but log error
    return data as T;
  }
  return result.data;
}

// GET /api/videos
export function useVideos() {
  return useQuery({
    queryKey: [api.videos.list.path],
    queryFn: async () => {
      const res = await fetch(api.videos.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch videos");
      const data = await res.json();
      return parseWithLogging<Video[]>(api.videos.list.responses[200], data, "videos.list");
    },
  });
}

// GET /api/videos/:id
export function useVideo(id: number) {
  return useQuery({
    queryKey: [api.videos.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.videos.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch video");
      const data = await res.json();
      return parseWithLogging<Video>(api.videos.get.responses[200], data, "videos.get");
    },
  });
}

// GET /api/videos/:id/status (for polling)
export function useVideoStatus(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [api.videos.status.path, id],
    queryFn: async () => {
      const url = buildUrl(api.videos.status.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch status");
      return await res.json();
    },
    enabled,
    refetchInterval: 5000, // Poll every 5s
  });
}

// POST /api/upload
export function useUploadVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(api.videos.upload.path, {
        method: api.videos.upload.method,
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Upload failed");
      }
      const data = await res.json();
      return parseWithLogging<Video>(api.videos.upload.responses[201], data, "videos.upload");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.videos.list.path] });
    },
  });
}

// PATCH /api/videos/:id
export function useUpdateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertVideo>) => {
      const url = buildUrl(api.videos.update.path, { id });
      const validated = api.videos.update.input.parse(updates);
      
      const res = await fetch(url, {
        method: api.videos.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to update video");
      const data = await res.json();
      return parseWithLogging<Video>(api.videos.update.responses[200], data, "videos.update");
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.videos.get.path, id] });
      queryClient.invalidateQueries({ queryKey: [api.videos.list.path] });
    },
  });
}

// POST /api/videos/:id/generate-metadata
export function useGenerateMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.videos.generateMetadata.path, { id });
      const res = await fetch(url, { 
        method: api.videos.generateMetadata.method, 
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to generate metadata");
      const data = await res.json();
      return parseWithLogging<Video>(api.videos.generateMetadata.responses[200], data, "videos.generateMetadata");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.videos.get.path, id] });
    },
  });
}

// POST /api/videos/:id/generate-thumbnail
export function useGenerateThumbnail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, prompt }: { id: number; prompt: string }) => {
      const url = buildUrl(api.videos.generateThumbnail.path, { id });
      const res = await fetch(url, {
        method: api.videos.generateThumbnail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate thumbnail");
      return await res.json(); // Returns { url: string }
    },
    onSuccess: (_, { id }) => {
      // We manually invalidate because this updates the video record indirectly
      queryClient.invalidateQueries({ queryKey: [api.videos.get.path, id] });
    },
  });
}

// POST /api/videos/:id/publish
export function usePublishVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, channelId }: { id: number; channelId?: string }) => {
      const url = buildUrl(api.videos.publish.path, { id });
      const res = await fetch(url, { 
        method: api.videos.publish.method,
        headers: channelId ? { "Content-Type": "application/json" } : {},
        body: channelId ? JSON.stringify({ channel_id: channelId }) : undefined,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to publish video");
      const data = await res.json();
      return parseWithLogging<Video>(api.videos.publish.responses[200], data, "videos.publish");
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.videos.get.path, id] });
    },
  });
}

// GET /api/my-channels - Fetch user's assigned YouTube channels
export function useMyChannels() {
  return useQuery({
    queryKey: ["/api/my-channels"],
    queryFn: async () => {
      const res = await fetch("/api/my-channels", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch channels");
      return await res.json() as { id: string; name: string }[];
    },
  });
}

// GET /api/me/publish-info - Fetch user's publishing permissions and channels
export interface PublishInfo {
  role: string;
  canPublish: boolean;
  showChannelSelector: boolean;
  channels: { id: string; name: string }[];
  defaultChannel: { id: string; name: string } | null;
}

export function usePublishInfo() {
  return useQuery({
    queryKey: ["/api/me/publish-info"],
    queryFn: async () => {
      const res = await fetch("/api/me/publish-info", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch publish info");
      return await res.json() as PublishInfo;
    },
  });
}

// POST /api/videos/:id/analyze-content-start - AI suggests where real content begins
export interface ContentStartAnalysis {
  suggestedStartMs: number;
  reason: string;
  confidence: string;
}

export function useAnalyzeContentStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/videos/${id}/analyze-content-start`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to analyze content");
      return await res.json() as ContentStartAnalysis;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.videos.get.path, id] });
    },
  });
}

// PATCH /api/videos/:id/trim - Save trim times
export function useSaveTrimTimes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, trimStartMs, trimEndMs }: { id: number; trimStartMs?: number | null; trimEndMs?: number | null }) => {
      const res = await fetch(`/api/videos/${id}/trim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trimStartMs, trimEndMs }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save trim times");
      }
      return await res.json() as Video;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.videos.get.path, id] });
    },
  });
}

// POST /api/videos/:id/analyze-content-end - AI suggests where educational content ends
export interface ContentEndAnalysis {
  suggestedEndMs: number | null;
  reason: string;
  confidence: string;
  shouldTrim: boolean;
}

export function useAnalyzeContentEnd() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/videos/${id}/analyze-content-end`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to analyze content end");
      return await res.json() as ContentEndAnalysis;
    },
  });
}
