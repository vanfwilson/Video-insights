import { pgTable, serial, text, timestamp, varchar, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";
import { relations } from "drizzle-orm";

export const ingestStatuses = ["queued", "downloading", "processing", "transcribing", "ready", "failed", "cancelled"] as const;
export type IngestStatus = typeof ingestStatuses[number];

export const videoIngestRequests = pgTable("video_ingest_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(),
  sourcePath: text("source_path").notNull(),
  sourceFileName: text("source_file_name").notNull(),
  sourceFileSize: integer("source_file_size"),
  status: text("status", { enum: ingestStatuses }).default("queued").notNull(),
  progress: jsonb("progress"),
  errorMessage: text("error_message"),
  videoId: integer("video_id"),
  downloadedPath: text("downloaded_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertVideoIngestRequestSchema = createInsertSchema(videoIngestRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type VideoIngestRequest = typeof videoIngestRequests.$inferSelect;
export type InsertVideoIngestRequest = z.infer<typeof insertVideoIngestRequestSchema>;

export const videoIngestRequestsRelations = relations(videoIngestRequests, ({ one }) => ({
  user: one(users, {
    fields: [videoIngestRequests.userId],
    references: [users.id],
  }),
}));
