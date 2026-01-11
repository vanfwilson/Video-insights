import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";
import { relations } from "drizzle-orm";

export * from "./models/auth";
export * from "./models/chat";
export * from "./models/workbook";
export * from "./models/cloud-connections";
export * from "./models/video-ingest";
export * from "./models/intel";

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  originalFilename: text("original_filename").notNull(),
  storagePath: text("storage_path").notNull(),
  status: text("status", { enum: ["uploading", "transcribing", "generating_metadata", "ready_to_edit", "publishing", "published", "failed"] }).default("uploading").notNull(),
  
  // AssemblyAI fields
  assemblyId: text("assembly_id"),
  transcript: text("transcript"), // SRT or raw text
  captions: jsonb("captions"), // Structured captions if needed, or just keep transcript

  // Metadata (AI generated / User edited)
  title: text("title"),
  description: text("description"),
  tags: text("tags"),
  thumbnailPrompt: text("thumbnail_prompt"),
  thumbnailUrl: text("thumbnail_url"),
  speakerImageUrl: text("speaker_image_url"),
  language: text("language").default("en"),

  // Video trim/clip fields
  durationMs: integer("duration_ms"), // Total video duration in milliseconds
  suggestedStartMs: integer("suggested_start_ms"), // AI-suggested content start time
  trimStartMs: integer("trim_start_ms"), // User-confirmed start time for trimming
  trimEndMs: integer("trim_end_ms"), // User-confirmed end time for trimming
  
  // Clip fields (for viral clips extracted from parent videos)
  parentVideoId: integer("parent_video_id"), // Self-reference to parent video
  startSec: integer("start_sec"), // Clip start time in seconds
  endSec: integer("end_sec"), // Clip end time in seconds
  hashtags: text("hashtags"), // Comma-separated hashtags for the clip
  sentiment: text("sentiment"), // AI-detected sentiment (positive, negative, neutral, etc.)
  categories: text("categories"), // Comma-separated categories
  
  // YouTube fields
  privacyStatus: text("privacy_status", { enum: ["public", "private", "unlisted"] }).default("private"),
  youtubeId: text("youtube_id"),
  youtubeUrl: text("youtube_url"),
  
  // Error tracking
  errorMessage: text("error_message"),

  // Confidentiality check fields
  confidentialityStatus: text("confidentiality_status", { 
    enum: ["pending", "checking", "clear", "flagged", "error"] 
  }).default("pending"),
  lastConfidentialityCheckId: integer("last_confidentiality_check_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videos).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const videosRelations = relations(videos, ({ one }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
}));

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

// Confidentiality segment type
export const confidentialitySegmentSchema = z.object({
  id: z.string(),
  startTime: z.string(), // HH:MM:SS format
  endTime: z.string(),
  category: z.enum(["proprietary", "financial", "personal_health", "company_secret", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  reason: z.string(),
  confidence: z.number(),
  resolutionStatus: z.enum(["pending", "resolved", "ignored"]).optional(),
  resolutionNote: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().optional(),
});

export type ConfidentialitySegment = z.infer<typeof confidentialitySegmentSchema>;

// Confidentiality checks table
export const confidentialityChecks = pgTable("confidentiality_checks", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").references(() => videos.id).notNull(),
  status: text("status", { 
    enum: ["pending", "running", "completed", "error"] 
  }).default("pending").notNull(),
  
  // Results
  overallStatus: text("overall_status", { 
    enum: ["clear", "flagged"] 
  }),
  segments: jsonb("segments").$type<ConfidentialitySegment[]>(),
  summary: text("summary"),
  
  // Severity counts
  highCount: integer("high_count").default(0),
  mediumCount: integer("medium_count").default(0),
  lowCount: integer("low_count").default(0),
  
  // Metadata
  modelUsed: text("model_used"),
  triggeredBy: varchar("triggered_by").references(() => users.id),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertConfidentialityCheckSchema = createInsertSchema(confidentialityChecks).omit({ 
  id: true, 
  createdAt: true,
  completedAt: true 
});

export type ConfidentialityCheck = typeof confidentialityChecks.$inferSelect;
export type InsertConfidentialityCheck = z.infer<typeof insertConfidentialityCheckSchema>;

// ============================================
// SEMANTIC SEARCH FEATURE
// ============================================

// Search result segment type
export const searchSegmentSchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  reason: z.string(),
});

export type SearchSegment = z.infer<typeof searchSegmentSchema>;

// Search result type
export const searchResultSchema = z.object({
  videoId: z.number(),
  videoTitle: z.string(),
  thumbnailUrl: z.string().nullable(),
  youtubeId: z.string().nullable(),
  relevanceScore: z.number(),
  matchSummary: z.string(),
  relevantSegments: z.array(searchSegmentSchema),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

// Search queries table
export const searchQueries = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  query: text("query").notNull(),
  results: jsonb("results").$type<SearchResult[]>(),
  totalFound: integer("total_found").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({ 
  id: true, 
  createdAt: true 
});

export type SearchQuery = typeof searchQueries.$inferSelect;
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;

// ============================================
// LOCAL LEADS & COMPETITORS FEATURE
// ============================================

// Client businesses table - stores the user's client businesses to search around
export const businessTypeEnum = ["ideal_customer", "competitor", "partnering_prospect"] as const;
export type BusinessType = typeof businessTypeEnum[number];

export const clientBusinesses = pgTable("client_businesses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  googleBusinessUrl: text("google_business_url"),
  keyword: text("keyword").notNull(),
  businessType: text("business_type", { enum: businessTypeEnum }).default("ideal_customer").notNull(),
  zipCode: text("zip_code"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientBusinessSchema = createInsertSchema(clientBusinesses).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});

export type ClientBusiness = typeof clientBusinesses.$inferSelect;
export type InsertClientBusiness = z.infer<typeof insertClientBusinessSchema>;

// Lead business schema (for JSONB storage) - aligned with n8n businesses table
export const leadBusinessSchema = z.object({
  position: z.number().optional(),
  title: z.string(),
  placeId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  email: z.string().optional(),
  emailStatus: z.enum(["unknown", "unverified", "valid", "invalid", "catch_all", "disposable"]).optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
  businessType: z.enum(["ideal_customer", "competitor", "partner", "lead"]).optional(),
  industry: z.string().optional(),
  category: z.enum(["PRIMARY", "SECONDARY", "EVENT_BASED"]).optional(),
  thumbnail: z.string().optional(),
  ownerName: z.string().optional(),
  confidence: z.number().optional(),
  domain: z.string().optional(),
  gpsCoordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  // Partnership fields
  partnershipScore: z.number().optional(),
  partnershipFactors: z.object({
    referralPotential: z.number().optional(),
    reputationMatch: z.number().optional(),
    establishedPresence: z.number().optional(),
  }).optional(),
  referralTrigger: z.string().optional(),
  partnershipModel: z.string().optional(),
  approachScript: z.string().optional(),
  potentialValue: z.enum(["Low", "Medium", "High", "Very High"]).optional(),
});

export type LeadBusiness = z.infer<typeof leadBusinessSchema>;

// Search types for lead search
export const searchTypesEnum = ["ideal_customer", "competitor", "partner"] as const;
export type SearchType = typeof searchTypesEnum[number];

// Lead search schedules table
export const leadSearchSchedules = pgTable("lead_search_schedules", {
  id: serial("id").primaryKey(),
  clientBusinessId: integer("client_business_id").references(() => clientBusinesses.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  scheduleType: text("schedule_type", { enum: ["interval", "weekly", "monthly"] }).default("weekly").notNull(),
  intervalDays: integer("interval_days"),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  runHour: integer("run_hour").default(9),
  timezone: text("timezone").default("America/New_York"),
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeadSearchScheduleSchema = createInsertSchema(leadSearchSchedules).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type LeadSearchSchedule = typeof leadSearchSchedules.$inferSelect;
export type InsertLeadSearchSchedule = z.infer<typeof insertLeadSearchScheduleSchema>;

// Lead searches table
export const leadSearches = pgTable("lead_searches", {
  id: serial("id").primaryKey(),
  clientBusinessId: integer("client_business_id").references(() => clientBusinesses.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  keyword: text("keyword").notNull(),
  geo: text("geo").notNull(),
  startOffset: integer("start_offset").default(0),
  // Search options
  searchTypes: text("search_types").array().$type<SearchType[]>().default(["ideal_customer", "competitor", "partner"]),
  verifyEmailsRequested: boolean("verify_emails_requested").default(false),
  status: text("status", { 
    enum: ["pending", "running", "completed", "error"] 
  }).default("pending").notNull(),
  results: jsonb("results").$type<LeadBusiness[]>(),
  totalFound: integer("total_found").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertLeadSearchSchema = createInsertSchema(leadSearches).omit({ 
  id: true, 
  createdAt: true,
  completedAt: true 
});

export type LeadSearch = typeof leadSearches.$inferSelect;
export type InsertLeadSearch = z.infer<typeof insertLeadSearchSchema>;

// Leads table (normalized storage) - aligned with n8n businesses table
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  clientBusinessId: integer("client_business_id").references(() => clientBusinesses.id).notNull(),
  leadSearchId: integer("lead_search_id").references(() => leadSearches.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Basic info
  position: integer("position"),
  title: text("title").notNull(),
  placeId: text("place_id").unique(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  phone: text("phone"),
  website: text("website"),
  
  // Contact data
  email: text("email"),
  emailStatus: text("email_status", {
    enum: ["unknown", "unverified", "valid", "invalid", "catch_all", "disposable"]
  }).default("unknown"),
  emailVerifiedAt: timestamp("email_verified_at"),
  
  // Business classification
  rating: text("rating"),
  reviewCount: integer("review_count"),
  businessType: text("business_type", {
    enum: ["ideal_customer", "competitor", "partner", "lead"]
  }).default("lead"),
  industry: text("industry"),
  category: text("category", {
    enum: ["PRIMARY", "SECONDARY", "EVENT_BASED"]
  }),
  
  // Partnership scoring (for partners)
  partnershipScore: integer("partnership_score"),
  partnershipFactors: jsonb("partnership_factors"),
  referralTrigger: text("referral_trigger"),
  partnershipModel: text("partnership_model"),
  approachScript: text("approach_script"),
  potentialValue: text("potential_value", {
    enum: ["Low", "Medium", "High", "Very High"]
  }),
  
  // Lead status tracking
  status: text("status", { 
    enum: ["new", "contacted", "qualified", "converted", "lost"] 
  }).default("new").notNull(),
  notes: text("notes"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

// SWOT item schema (for leads SWOT)
export const swotItemSchema = z.object({
  text: z.string(),
  source: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
});

export type SwotItem = z.infer<typeof swotItemSchema>;

// Leads SWOT analyses table (for competitor analysis - different from workbook SWOT)
export const leadsSwotAnalyses = pgTable("swot_analyses", {
  id: serial("id").primaryKey(),
  clientBusinessId: integer("client_business_id").references(() => clientBusinesses.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  strengths: jsonb("strengths").$type<SwotItem[]>(),
  weaknesses: jsonb("weaknesses").$type<SwotItem[]>(),
  opportunities: jsonb("opportunities").$type<SwotItem[]>(),
  threats: jsonb("threats").$type<SwotItem[]>(),
  summary: text("summary"),
  modelUsed: text("model_used"),
  leadsAnalyzed: integer("leads_analyzed").default(0),
  status: text("status", { 
    enum: ["pending", "generating", "completed", "error"] 
  }).default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertLeadsSwotAnalysisSchema = createInsertSchema(leadsSwotAnalyses).omit({ 
  id: true, 
  createdAt: true,
  completedAt: true 
});

export type LeadsSwotAnalysis = typeof leadsSwotAnalyses.$inferSelect;
export type InsertLeadsSwotAnalysis = z.infer<typeof insertLeadsSwotAnalysisSchema>;
