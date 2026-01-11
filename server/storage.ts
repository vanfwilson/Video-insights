import { db } from "./db";
import { 
  videos, type InsertVideo, type Video,
  users, type User, type UpsertUser, type UserRole,
  youtubeChannels, type YoutubeChannel, type InsertYoutubeChannel,
  userChannels, type UserChannel,
  workbookProgress, type WorkbookProgress, type InsertWorkbookProgress,
  coreValues, type CoreValue, type InsertCoreValue,
  swotAnalyses, type SwotAnalysis, type InsertSwotAnalysis,
  rootCauseCharts, type RootCauseChart, type InsertRootCauseChart,
  timeAudits, type TimeAudit, type InsertTimeAudit,
  actionPlans, type ActionPlan, type InsertActionPlan,
  cloudConnections, type CloudConnection, type InsertCloudConnection, type CloudProvider,
  videoIngestRequests, type VideoIngestRequest, type InsertVideoIngestRequest, type IngestStatus,
  confidentialityChecks, type ConfidentialityCheck, type InsertConfidentialityCheck,
  searchQueries, type SearchQuery, type InsertSearchQuery,
  clientBusinesses, type ClientBusiness, type InsertClientBusiness,
  leadSearches, type LeadSearch, type InsertLeadSearch,
  leads, type Lead, type InsertLead,
  leadsSwotAnalyses, type LeadsSwotAnalysis, type InsertLeadsSwotAnalysis
} from "@shared/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Video operations
  createVideo(video: InsertVideo): Promise<Video>;
  getVideo(id: number): Promise<Video | undefined>;
  getVideosByUser(userId: string): Promise<Video[]>;
  updateVideo(id: number, updates: Partial<InsertVideo>): Promise<Video>;
  deleteVideo(id: number): Promise<void>;
  
  // User operations (admin)
  getAllUsers(): Promise<User[]>;
  createUserManual(user: { id: string; email: string; firstName?: string; lastName?: string; role: UserRole; defaultChannelId?: string | null; notes?: string | null }): Promise<User>;
  updateUserDetails(userId: string, updates: { email?: string; firstName?: string; lastName?: string; role?: UserRole; defaultChannelId?: string | null; notes?: string | null }): Promise<User | undefined>;
  setUserChannels(userId: string, channelIds: string[]): Promise<void>;
  updateUserRole(userId: string, role: UserRole): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;
  
  // YouTube channel operations
  getAllChannels(): Promise<YoutubeChannel[]>;
  getChannel(id: string): Promise<YoutubeChannel | undefined>;
  createChannel(channel: InsertYoutubeChannel): Promise<YoutubeChannel | null>;
  deleteChannel(id: string): Promise<void>;
  
  // User-channel assignment
  getUserChannels(userId: string): Promise<YoutubeChannel[]>;
  assignUserChannel(userId: string, channelId: string): Promise<void>;
  removeUserChannel(userId: string, channelId: string): Promise<void>;
  
  // Workbook operations
  getWorkbookProgress(userId: string): Promise<WorkbookProgress | null>;
  upsertWorkbookProgress(userId: string, data: Partial<InsertWorkbookProgress>): Promise<WorkbookProgress>;
  getCoreValue(userId: string): Promise<CoreValue | null>;
  upsertCoreValue(userId: string, data: Partial<InsertCoreValue>): Promise<CoreValue>;
  getSwotAnalysis(userId: string, businessArea: string): Promise<SwotAnalysis | null>;
  getAllSwotAnalyses(userId: string): Promise<SwotAnalysis[]>;
  upsertSwotAnalysis(userId: string, data: Partial<InsertSwotAnalysis>): Promise<SwotAnalysis>;
  getRootCauseChart(userId: string): Promise<RootCauseChart | null>;
  upsertRootCauseChart(userId: string, data: Partial<InsertRootCauseChart>): Promise<RootCauseChart>;
  getTimeAudit(userId: string): Promise<TimeAudit | null>;
  upsertTimeAudit(userId: string, data: Partial<InsertTimeAudit>): Promise<TimeAudit>;
  getActionPlan(userId: string): Promise<ActionPlan | null>;
  upsertActionPlan(userId: string, data: Partial<InsertActionPlan>): Promise<ActionPlan>;
  
  // Cloud connections
  getCloudConnection(userId: string, provider: CloudProvider): Promise<CloudConnection | null>;
  getAllCloudConnections(userId: string): Promise<CloudConnection[]>;
  upsertCloudConnection(userId: string, provider: CloudProvider, data: Partial<InsertCloudConnection>): Promise<CloudConnection>;
  deleteCloudConnection(userId: string, provider: CloudProvider): Promise<void>;
  
  // Video ingest requests
  createVideoIngestRequest(data: InsertVideoIngestRequest): Promise<VideoIngestRequest>;
  createVideoIngestRequests(data: InsertVideoIngestRequest[]): Promise<VideoIngestRequest[]>;
  getVideoIngestRequest(id: number): Promise<VideoIngestRequest | null>;
  getVideoIngestRequestsByUser(userId: string): Promise<VideoIngestRequest[]>;
  getQueuedIngestRequests(): Promise<VideoIngestRequest[]>;
  getNextQueuedRequest(): Promise<VideoIngestRequest | null>;
  updateVideoIngestRequest(id: number, updates: Partial<InsertVideoIngestRequest>): Promise<VideoIngestRequest>;
  cancelVideoIngestRequest(id: number): Promise<void>;
  
  // Confidentiality check operations
  createConfidentialityCheck(check: InsertConfidentialityCheck): Promise<ConfidentialityCheck>;
  updateConfidentialityCheck(id: number, updates: Partial<InsertConfidentialityCheck>): Promise<ConfidentialityCheck>;
  getLatestConfidentialityCheck(videoId: number): Promise<ConfidentialityCheck | undefined>;
  getUnsecuredVideos(): Promise<{ total: number; videos: Array<{ video: Video; unresolvedCount: number; highCount: number; mediumCount: number; lowCount: number }> }>;
  
  // Client business operations
  getClientBusinesses(userId: string): Promise<ClientBusiness[]>;
  getClientBusiness(id: number): Promise<ClientBusiness | undefined>;
  createClientBusiness(data: InsertClientBusiness): Promise<ClientBusiness>;
  updateClientBusiness(id: number, updates: Partial<InsertClientBusiness>): Promise<ClientBusiness>;
  deleteClientBusiness(id: number): Promise<void>;
  
  // Lead search operations
  createLeadSearch(data: InsertLeadSearch): Promise<LeadSearch>;
  updateLeadSearch(id: number, updates: Partial<LeadSearch>): Promise<LeadSearch>;
  getLatestLeadSearch(clientId: number): Promise<LeadSearch | undefined>;
  getLeadSearches(clientId: number): Promise<LeadSearch[]>;
  
  // Leads SWOT operations
  createLeadsSwotAnalysis(data: InsertLeadsSwotAnalysis): Promise<LeadsSwotAnalysis>;
  updateLeadsSwotAnalysis(id: number, updates: Partial<InsertLeadsSwotAnalysis>): Promise<LeadsSwotAnalysis>;
  getSwotAnalysesForClient(clientId: number): Promise<LeadsSwotAnalysis[]>;
  
  // Semantic search operations
  getPublishedVideosWithTranscripts(): Promise<Video[]>;
  saveSearchQuery(data: InsertSearchQuery): Promise<SearchQuery>;
  getRecentSearches(userId: string, limit: number): Promise<SearchQuery[]>;
  
  // Clip operations
  getClipsForVideo(parentVideoId: number, userId: string): Promise<Video[]>;
  getAllVideos(): Promise<Video[]>;
}

export class DatabaseStorage implements IStorage {
  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }

  async getVideo(id: number): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async getVideosByUser(userId: string): Promise<Video[]> {
    return db.select().from(videos).where(eq(videos.userId, userId));
  }

  async updateVideo(id: number, updates: Partial<InsertVideo>): Promise<Video> {
    const [updatedVideo] = await db
      .update(videos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updatedVideo;
  }

  async deleteVideo(id: number): Promise<void> {
    await db.delete(videos).where(eq(videos.id, id));
  }
  
  // User operations (admin)
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async createUserManual(user: { id: string; email: string; firstName?: string; lastName?: string; role: UserRole; defaultChannelId?: string | null; notes?: string | null }): Promise<User> {
    const [newUser] = await db.insert(users).values({
      id: user.id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      role: user.role,
      defaultChannelId: user.defaultChannelId || null,
      notes: user.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return newUser;
  }
  
  async updateUserDetails(userId: string, updates: { email?: string; firstName?: string; lastName?: string; role?: UserRole; defaultChannelId?: string | null; notes?: string | null }): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  async setUserChannels(userId: string, channelIds: string[]): Promise<void> {
    // Delete all existing assignments
    await db.delete(userChannels).where(eq(userChannels.userId, userId));
    // Insert new assignments
    if (channelIds.length > 0) {
      await db.insert(userChannels).values(
        channelIds.map(channelId => ({ userId, channelId }))
      );
    }
  }
  
  async updateUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  async deleteUser(userId: string): Promise<void> {
    // First delete user's channel assignments
    await db.delete(userChannels).where(eq(userChannels.userId, userId));
    // Then delete the user
    await db.delete(users).where(eq(users.id, userId));
  }
  
  async updateUserDefaultChannel(userId: string, channelId: string | null): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ defaultChannelId: channelId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  // YouTube channel operations
  async getAllChannels(): Promise<YoutubeChannel[]> {
    return db.select().from(youtubeChannels);
  }
  
  async getChannel(id: string): Promise<YoutubeChannel | undefined> {
    const [channel] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.id, id));
    return channel;
  }
  
  async createChannel(channel: InsertYoutubeChannel): Promise<YoutubeChannel | null> {
    // Check if channel already exists
    const existing = await this.getChannel(channel.id);
    if (existing) return null; // Signal conflict
    
    const [newChannel] = await db
      .insert(youtubeChannels)
      .values(channel)
      .returning();
    return newChannel;
  }
  
  async deleteChannel(id: string): Promise<void> {
    await db.delete(userChannels).where(eq(userChannels.channelId, id));
    await db.delete(youtubeChannels).where(eq(youtubeChannels.id, id));
  }
  
  // User-channel assignment
  async getUserChannels(userId: string): Promise<YoutubeChannel[]> {
    const assignments = await db
      .select({ channel: youtubeChannels })
      .from(userChannels)
      .innerJoin(youtubeChannels, eq(userChannels.channelId, youtubeChannels.id))
      .where(eq(userChannels.userId, userId));
    return assignments.map(a => a.channel);
  }
  
  async assignUserChannel(userId: string, channelId: string): Promise<void> {
    // Use onConflictDoNothing with the composite primary key
    await db.insert(userChannels)
      .values({ userId, channelId })
      .onConflictDoNothing({ target: [userChannels.userId, userChannels.channelId] });
  }
  
  async removeUserChannel(userId: string, channelId: string): Promise<void> {
    await db.delete(userChannels).where(
      and(eq(userChannels.userId, userId), eq(userChannels.channelId, channelId))
    );
  }
  
  // Workbook Progress
  async getWorkbookProgress(userId: string): Promise<WorkbookProgress | null> {
    const [progress] = await db.select().from(workbookProgress).where(eq(workbookProgress.userId, userId));
    return progress || null;
  }
  
  async upsertWorkbookProgress(userId: string, data: Partial<InsertWorkbookProgress>): Promise<WorkbookProgress> {
    const existing = await this.getWorkbookProgress(userId);
    if (existing) {
      const [updated] = await db
        .update(workbookProgress)
        .set({ ...data, lastUpdated: new Date(), updatedAt: new Date() })
        .where(eq(workbookProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(workbookProgress)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }
  
  // Core Value
  async getCoreValue(userId: string): Promise<CoreValue | null> {
    const [value] = await db.select().from(coreValues).where(eq(coreValues.userId, userId));
    return value || null;
  }
  
  async upsertCoreValue(userId: string, data: Partial<InsertCoreValue>): Promise<CoreValue> {
    const existing = await this.getCoreValue(userId);
    if (existing) {
      const [updated] = await db
        .update(coreValues)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(coreValues.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(coreValues)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }
  
  // SWOT Analysis
  async getSwotAnalysis(userId: string, businessArea: string): Promise<SwotAnalysis | null> {
    const [analysis] = await db.select().from(swotAnalyses).where(
      and(eq(swotAnalyses.userId, userId), eq(swotAnalyses.businessArea, businessArea as any))
    );
    return analysis || null;
  }
  
  async getAllSwotAnalyses(userId: string): Promise<SwotAnalysis[]> {
    return db.select().from(swotAnalyses).where(eq(swotAnalyses.userId, userId));
  }
  
  async upsertSwotAnalysis(userId: string, data: Partial<InsertSwotAnalysis>): Promise<SwotAnalysis> {
    const businessArea = data.businessArea || 'overall';
    const existing = await this.getSwotAnalysis(userId, businessArea);
    if (existing) {
      const [updated] = await db
        .update(swotAnalyses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(swotAnalyses.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(swotAnalyses)
        .values({ userId, businessArea: businessArea as any, ...data })
        .returning();
      return created;
    }
  }
  
  // Root Cause Chart
  async getRootCauseChart(userId: string): Promise<RootCauseChart | null> {
    const [chart] = await db.select().from(rootCauseCharts).where(eq(rootCauseCharts.userId, userId));
    return chart || null;
  }
  
  async upsertRootCauseChart(userId: string, data: Partial<InsertRootCauseChart>): Promise<RootCauseChart> {
    const existing = await this.getRootCauseChart(userId);
    if (existing) {
      const [updated] = await db
        .update(rootCauseCharts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(rootCauseCharts.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(rootCauseCharts)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }
  
  // Time Audit
  async getTimeAudit(userId: string): Promise<TimeAudit | null> {
    const [audit] = await db.select().from(timeAudits).where(eq(timeAudits.userId, userId));
    return audit || null;
  }
  
  async upsertTimeAudit(userId: string, data: Partial<InsertTimeAudit>): Promise<TimeAudit> {
    const existing = await this.getTimeAudit(userId);
    if (existing) {
      const [updated] = await db
        .update(timeAudits)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(timeAudits.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(timeAudits)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }
  
  // Action Plan
  async getActionPlan(userId: string): Promise<ActionPlan | null> {
    const [plan] = await db.select().from(actionPlans).where(eq(actionPlans.userId, userId));
    return plan || null;
  }
  
  async upsertActionPlan(userId: string, data: Partial<InsertActionPlan>): Promise<ActionPlan> {
    const existing = await this.getActionPlan(userId);
    if (existing) {
      const [updated] = await db
        .update(actionPlans)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(actionPlans.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(actionPlans)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }
  
  // Cloud Connections
  async getCloudConnection(userId: string, provider: CloudProvider): Promise<CloudConnection | null> {
    const [connection] = await db.select().from(cloudConnections)
      .where(and(eq(cloudConnections.userId, userId), eq(cloudConnections.provider, provider)));
    return connection || null;
  }
  
  async getAllCloudConnections(userId: string): Promise<CloudConnection[]> {
    return db.select().from(cloudConnections).where(eq(cloudConnections.userId, userId));
  }
  
  async upsertCloudConnection(userId: string, provider: CloudProvider, data: Partial<InsertCloudConnection>): Promise<CloudConnection> {
    const existing = await this.getCloudConnection(userId, provider);
    if (existing) {
      const [updated] = await db
        .update(cloudConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(cloudConnections.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(cloudConnections)
        .values({ userId, provider, ...data })
        .returning();
      return created;
    }
  }
  
  async deleteCloudConnection(userId: string, provider: CloudProvider): Promise<void> {
    await db.delete(cloudConnections)
      .where(and(eq(cloudConnections.userId, userId), eq(cloudConnections.provider, provider)));
  }
  
  // Video Ingest Requests
  async createVideoIngestRequest(data: InsertVideoIngestRequest): Promise<VideoIngestRequest> {
    const [request] = await db.insert(videoIngestRequests).values(data).returning();
    return request;
  }
  
  async createVideoIngestRequests(data: InsertVideoIngestRequest[]): Promise<VideoIngestRequest[]> {
    if (data.length === 0) return [];
    return db.insert(videoIngestRequests).values(data).returning();
  }
  
  async getVideoIngestRequest(id: number): Promise<VideoIngestRequest | null> {
    const [request] = await db.select().from(videoIngestRequests).where(eq(videoIngestRequests.id, id));
    return request || null;
  }
  
  async getVideoIngestRequestsByUser(userId: string): Promise<VideoIngestRequest[]> {
    return db.select().from(videoIngestRequests)
      .where(eq(videoIngestRequests.userId, userId))
      .orderBy(desc(videoIngestRequests.createdAt));
  }
  
  async getQueuedIngestRequests(): Promise<VideoIngestRequest[]> {
    return db.select().from(videoIngestRequests)
      .where(eq(videoIngestRequests.status, 'queued'))
      .orderBy(videoIngestRequests.createdAt);
  }
  
  async getNextQueuedRequest(): Promise<VideoIngestRequest | null> {
    const [request] = await db.select().from(videoIngestRequests)
      .where(eq(videoIngestRequests.status, 'queued'))
      .orderBy(videoIngestRequests.createdAt)
      .limit(1);
    return request || null;
  }
  
  async updateVideoIngestRequest(id: number, updates: Partial<InsertVideoIngestRequest>): Promise<VideoIngestRequest> {
    const [updated] = await db
      .update(videoIngestRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoIngestRequests.id, id))
      .returning();
    return updated;
  }
  
  async cancelVideoIngestRequest(id: number): Promise<void> {
    await db
      .update(videoIngestRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(videoIngestRequests.id, id));
  }
  
  // Confidentiality check operations
  async createConfidentialityCheck(check: InsertConfidentialityCheck): Promise<ConfidentialityCheck> {
    const [newCheck] = await db.insert(confidentialityChecks).values(check).returning();
    return newCheck;
  }
  
  async updateConfidentialityCheck(id: number, updates: Partial<InsertConfidentialityCheck>): Promise<ConfidentialityCheck> {
    const [updated] = await db
      .update(confidentialityChecks)
      .set(updates)
      .where(eq(confidentialityChecks.id, id))
      .returning();
    return updated;
  }
  
  async getLatestConfidentialityCheck(videoId: number): Promise<ConfidentialityCheck | undefined> {
    const [check] = await db
      .select()
      .from(confidentialityChecks)
      .where(eq(confidentialityChecks.videoId, videoId))
      .orderBy(desc(confidentialityChecks.createdAt))
      .limit(1);
    return check;
  }
  
  async getUnsecuredVideos(): Promise<{ total: number; videos: Array<{ video: Video; unresolvedCount: number; highCount: number; mediumCount: number; lowCount: number }> }> {
    const flaggedVideos = await db
      .select()
      .from(videos)
      .where(eq(videos.confidentialityStatus, "flagged"));
    
    const result: Array<{ video: Video; unresolvedCount: number; highCount: number; mediumCount: number; lowCount: number }> = [];
    
    for (const video of flaggedVideos) {
      const check = await this.getLatestConfidentialityCheck(video.id);
      if (!check || !check.segments) continue;
      
      const segments = check.segments as any[];
      const unresolvedSegments = segments.filter(
        (s: any) => !s.resolutionStatus || s.resolutionStatus === 'pending'
      );
      
      if (unresolvedSegments.length > 0) {
        result.push({
          video,
          unresolvedCount: unresolvedSegments.length,
          highCount: unresolvedSegments.filter((s: any) => s.severity === 'high').length,
          mediumCount: unresolvedSegments.filter((s: any) => s.severity === 'medium').length,
          lowCount: unresolvedSegments.filter((s: any) => s.severity === 'low').length,
        });
      }
    }
    
    return { total: result.length, videos: result };
  }
  
  // Client business operations
  async getClientBusinesses(userId: string): Promise<ClientBusiness[]> {
    return db.select().from(clientBusinesses)
      .where(eq(clientBusinesses.userId, userId))
      .orderBy(desc(clientBusinesses.createdAt));
  }
  
  async getClientBusiness(id: number): Promise<ClientBusiness | undefined> {
    const [client] = await db.select().from(clientBusinesses).where(eq(clientBusinesses.id, id));
    return client;
  }
  
  async createClientBusiness(data: InsertClientBusiness): Promise<ClientBusiness> {
    const [newClient] = await db.insert(clientBusinesses).values(data).returning();
    return newClient;
  }
  
  async updateClientBusiness(id: number, updates: Partial<InsertClientBusiness>): Promise<ClientBusiness> {
    const [updated] = await db.update(clientBusinesses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clientBusinesses.id, id))
      .returning();
    return updated;
  }
  
  async deleteClientBusiness(id: number): Promise<void> {
    await db.delete(clientBusinesses).where(eq(clientBusinesses.id, id));
  }
  
  // Lead search operations
  async createLeadSearch(data: InsertLeadSearch): Promise<LeadSearch> {
    const [newSearch] = await db.insert(leadSearches).values(data as any).returning();
    return newSearch;
  }
  
  async updateLeadSearch(id: number, updates: Partial<LeadSearch>): Promise<LeadSearch> {
    const [updated] = await db.update(leadSearches)
      .set(updates as any)
      .where(eq(leadSearches.id, id))
      .returning();
    return updated;
  }
  
  async getLatestLeadSearch(clientId: number): Promise<LeadSearch | undefined> {
    const [search] = await db.select().from(leadSearches)
      .where(eq(leadSearches.clientBusinessId, clientId))
      .orderBy(desc(leadSearches.createdAt))
      .limit(1);
    return search;
  }
  
  async getLeadSearches(clientId: number): Promise<LeadSearch[]> {
    return db.select().from(leadSearches)
      .where(eq(leadSearches.clientBusinessId, clientId))
      .orderBy(desc(leadSearches.createdAt));
  }
  
  // Leads SWOT operations
  async createLeadsSwotAnalysis(data: InsertLeadsSwotAnalysis): Promise<LeadsSwotAnalysis> {
    const [newAnalysis] = await db.insert(leadsSwotAnalyses).values(data).returning();
    return newAnalysis;
  }
  
  async updateLeadsSwotAnalysis(id: number, updates: Partial<InsertLeadsSwotAnalysis>): Promise<LeadsSwotAnalysis> {
    const [updated] = await db.update(leadsSwotAnalyses)
      .set(updates)
      .where(eq(leadsSwotAnalyses.id, id))
      .returning();
    return updated;
  }
  
  async getSwotAnalysesForClient(clientId: number): Promise<LeadsSwotAnalysis[]> {
    return db.select().from(leadsSwotAnalyses)
      .where(eq(leadsSwotAnalyses.clientBusinessId, clientId))
      .orderBy(desc(leadsSwotAnalyses.createdAt));
  }
  
  // Semantic search operations
  async getPublishedVideosWithTranscripts(): Promise<Video[]> {
    return db.select().from(videos)
      .where(isNotNull(videos.transcript));
  }
  
  async saveSearchQuery(data: InsertSearchQuery): Promise<SearchQuery> {
    const [query] = await db.insert(searchQueries).values(data).returning();
    return query;
  }
  
  async getRecentSearches(userId: string, limit: number): Promise<SearchQuery[]> {
    return db.select().from(searchQueries)
      .where(eq(searchQueries.userId, userId))
      .orderBy(desc(searchQueries.createdAt))
      .limit(limit);
  }
  
  // Clip operations
  async getClipsForVideo(parentVideoId: number, userId: string): Promise<Video[]> {
    return db.select().from(videos)
      .where(and(
        eq(videos.parentVideoId, parentVideoId),
        eq(videos.userId, userId)
      ))
      .orderBy(desc(videos.createdAt));
  }
  
  async getAllVideos(): Promise<Video[]> {
    return db.select().from(videos).orderBy(desc(videos.createdAt));
  }
}

export const storage = new DatabaseStorage();
