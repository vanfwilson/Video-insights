import { pgTable, serial, text, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";
import { relations } from "drizzle-orm";

export const cloudProviders = ["dropbox", "google_drive", "onedrive", "s3", "gcs", "azure_blob"] as const;
export type CloudProvider = typeof cloudProviders[number];

export const cloudConnections = pgTable("cloud_connections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: text("provider", { enum: cloudProviders }).notNull(),
  accountId: text("account_id"),
  accountName: text("account_name"),
  accountEmail: text("account_email"),
  profilePhotoUrl: text("profile_photo_url"),
  selectedFolderPath: text("selected_folder_path"),
  selectedFolderName: text("selected_folder_name"),
  isActive: text("is_active").default("true"),
  lastSyncedAt: timestamp("last_synced_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCloudConnectionSchema = createInsertSchema(cloudConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CloudConnection = typeof cloudConnections.$inferSelect;
export type InsertCloudConnection = z.infer<typeof insertCloudConnectionSchema>;

export const cloudConnectionsRelations = relations(cloudConnections, ({ one }) => ({
  user: one(users, {
    fields: [cloudConnections.userId],
    references: [users.id],
  }),
}));
