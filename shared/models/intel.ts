import { pgTable, text, serial, integer, timestamp, varchar, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const intelAnalyses = pgTable("intel_analyses", {
  id: serial("id").primaryKey(),
  clientBusinessId: integer("client_business_id").notNull(),
  analysisType: varchar("analysis_type", { length: 50 }).notNull(),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntelAnalysisSchema = createInsertSchema(intelAnalyses).omit({
  id: true,
  createdAt: true,
});

export type IntelAnalysis = typeof intelAnalyses.$inferSelect;
export type InsertIntelAnalysis = z.infer<typeof insertIntelAnalysisSchema>;

export const intelBusinesses = pgTable("intel_businesses", {
  id: serial("id").primaryKey(),
  clientBusinessId: integer("client_business_id").notNull(),
  placeId: varchar("place_id", { length: 100 }).unique(),
  name: varchar("name", { length: 255 }),
  businessType: varchar("business_type", { length: 50 }),
  industry: varchar("industry", { length: 100 }),
  category: varchar("category", { length: 50 }),
  rating: decimal("rating", { precision: 2, scale: 1 }),
  reviewCount: integer("review_count"),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 255 }),
  email: varchar("email", { length: 255 }),
  emailStatus: varchar("email_status", { length: 20 }).default("unknown"),
  partnershipScore: integer("partnership_score"),
  referralTrigger: text("referral_trigger"),
  approachScript: text("approach_script"),
  potentialValue: varchar("potential_value", { length: 20 }),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIntelBusinessSchema = createInsertSchema(intelBusinesses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type IntelBusiness = typeof intelBusinesses.$inferSelect;
export type InsertIntelBusiness = z.infer<typeof insertIntelBusinessSchema>;
