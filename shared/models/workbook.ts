import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, varchar, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";
import { relations } from "drizzle-orm";

export const workbookProgressStatuses = ["in_progress", "completed", "archived"] as const;
export type WorkbookProgressStatus = typeof workbookProgressStatuses[number];

export const workbookProgress = pgTable("workbook_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  completedSections: text("completed_sections").array().default([]),
  completionPercentage: integer("completion_percentage").default(0),
  status: text("status", { enum: workbookProgressStatuses }).default("in_progress"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkbookProgressSchema = createInsertSchema(workbookProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type WorkbookProgress = typeof workbookProgress.$inferSelect;
export type InsertWorkbookProgress = z.infer<typeof insertWorkbookProgressSchema>;

export const coreValueStatuses = ["draft", "complete"] as const;

export const coreValues = pgTable("core_values", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  workbookId: integer("workbook_id").references(() => workbookProgress.id),
  howYouWereMade: text("how_you_were_made"),
  businessGiven: text("business_given"),
  desireForCustomers: text("desire_for_customers"),
  problemsYouSolve: text("problems_you_solve"),
  principleAtHeart: text("principle_at_heart"),
  feelingsGenerated: text("feelings_generated"),
  coreValueDraft1: varchar("core_value_draft_1"),
  coreValueDraft2: varchar("core_value_draft_2"),
  coreValueFinal: varchar("core_value_final"),
  aiSuggestions: text("ai_suggestions").array().default([]),
  alignmentScores: jsonb("alignment_scores"),
  status: text("status", { enum: coreValueStatuses }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCoreValueSchema = createInsertSchema(coreValues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CoreValue = typeof coreValues.$inferSelect;
export type InsertCoreValue = z.infer<typeof insertCoreValueSchema>;

export const swotBusinessAreas = [
  "overall", "products_services", "marketing", "sales",
  "operations", "finance", "territory", "people",
  "tech", "assets", "structure"
] as const;

export const swotAnalyses = pgTable("swot_analyses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  workbookId: integer("workbook_id").references(() => workbookProgress.id),
  businessArea: text("business_area", { enum: swotBusinessAreas }).default("overall"),
  strengths: jsonb("strengths"),
  weaknesses: jsonb("weaknesses"),
  opportunities: jsonb("opportunities"),
  threats: jsonb("threats"),
  keyInsight: text("key_insight"),
  keyMetric: varchar("key_metric"),
  aiPatterns: text("ai_patterns").array().default([]),
  status: text("status", { enum: coreValueStatuses }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSwotAnalysisSchema = createInsertSchema(swotAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SwotAnalysis = typeof swotAnalyses.$inferSelect;
export type InsertSwotAnalysis = z.infer<typeof insertSwotAnalysisSchema>;

export const rootCauseCharts = pgTable("root_cause_charts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  workbookId: integer("workbook_id").references(() => workbookProgress.id),
  beforeTriggers: text("before_triggers"),
  problemDescription: text("problem_description"),
  afterResults: text("after_results"),
  fiveWhys: jsonb("five_whys"),
  whenWhereHow: text("when_where_how"),
  whoAffected: text("who_affected"),
  whenNotIssue: text("when_not_issue"),
  whatDriving: text("what_driving"),
  conditionsWorse: text("conditions_worse"),
  howStopForever: text("how_stop_forever"),
  whoWinsLoses: text("who_wins_loses"),
  whatStoppingUs: text("what_stopping_us"),
  symptom: text("symptom"),
  rootCause: text("root_cause"),
  priorityImpact: text("priority_impact"),
  problemStatement: text("problem_statement"),
  affectedAreas: text("affected_areas").array().default([]),
  aiRootCauseSuggestion: text("ai_root_cause_suggestion"),
  status: text("status", { enum: coreValueStatuses }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRootCauseChartSchema = createInsertSchema(rootCauseCharts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type RootCauseChart = typeof rootCauseCharts.$inferSelect;
export type InsertRootCauseChart = z.infer<typeof insertRootCauseChartSchema>;

export const timeAudits = pgTable("time_audits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  workbookId: integer("workbook_id").references(() => workbookProgress.id),
  ownerRate: integer("owner_rate").default(150),
  tasks: jsonb("tasks"),
  totalHoursLogged: integer("total_hours_logged").default(0),
  highValueHours: integer("high_value_hours").default(0),
  mediumValueHours: integer("medium_value_hours").default(0),
  lowValueHours: integer("low_value_hours").default(0),
  tasksToDelegate: jsonb("tasks_to_delegate"),
  hoursToReclaim: integer("hours_to_reclaim").default(0),
  whatToDoWithTime: text("what_to_do_with_time"),
  timeManagementRating: integer("time_management_rating").default(3),
  biggestTimeWasters: text("biggest_time_wasters").array().default([]),
  status: text("status", { enum: coreValueStatuses }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTimeAuditSchema = createInsertSchema(timeAudits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TimeAudit = typeof timeAudits.$inferSelect;
export type InsertTimeAudit = z.infer<typeof insertTimeAuditSchema>;

export const actionPlans = pgTable("action_plans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  workbookId: integer("workbook_id").references(() => workbookProgress.id),
  selectedStrategy: varchar("selected_strategy"),
  strategyLabel: varchar("strategy_label"),
  milestones: jsonb("milestones"),
  tasks: jsonb("tasks"),
  metrics: jsonb("metrics"),
  quarterStartDate: timestamp("quarter_start_date"),
  weeklyGoals: jsonb("weekly_goals"),
  notes: text("notes"),
  status: text("status", { enum: coreValueStatuses }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertActionPlanSchema = createInsertSchema(actionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ActionPlan = typeof actionPlans.$inferSelect;
export type InsertActionPlan = z.infer<typeof insertActionPlanSchema>;

export const aiCoachConversations = pgTable("ai_coach_conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  workbookId: integer("workbook_id").references(() => workbookProgress.id),
  section: varchar("section"),
  messages: jsonb("messages"),
  keyInsights: text("key_insights").array().default([]),
  actionItems: text("action_items").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiCoachConversationSchema = createInsertSchema(aiCoachConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AiCoachConversation = typeof aiCoachConversations.$inferSelect;
export type InsertAiCoachConversation = z.infer<typeof insertAiCoachConversationSchema>;

export const workbookProgressRelations = relations(workbookProgress, ({ one }) => ({
  user: one(users, {
    fields: [workbookProgress.userId],
    references: [users.id],
  }),
}));

export const coreValuesRelations = relations(coreValues, ({ one }) => ({
  user: one(users, {
    fields: [coreValues.userId],
    references: [users.id],
  }),
  progress: one(workbookProgress, {
    fields: [coreValues.workbookId],
    references: [workbookProgress.id],
  }),
}));

export const swotAnalysesRelations = relations(swotAnalyses, ({ one }) => ({
  user: one(users, {
    fields: [swotAnalyses.userId],
    references: [users.id],
  }),
  progress: one(workbookProgress, {
    fields: [swotAnalyses.workbookId],
    references: [workbookProgress.id],
  }),
}));

export const rootCauseChartsRelations = relations(rootCauseCharts, ({ one }) => ({
  user: one(users, {
    fields: [rootCauseCharts.userId],
    references: [users.id],
  }),
  progress: one(workbookProgress, {
    fields: [rootCauseCharts.workbookId],
    references: [workbookProgress.id],
  }),
}));

export const timeAuditsRelations = relations(timeAudits, ({ one }) => ({
  user: one(users, {
    fields: [timeAudits.userId],
    references: [users.id],
  }),
  progress: one(workbookProgress, {
    fields: [timeAudits.workbookId],
    references: [workbookProgress.id],
  }),
}));

export const actionPlansRelations = relations(actionPlans, ({ one }) => ({
  user: one(users, {
    fields: [actionPlans.userId],
    references: [users.id],
  }),
  progress: one(workbookProgress, {
    fields: [actionPlans.workbookId],
    references: [workbookProgress.id],
  }),
}));

export const aiCoachConversationsRelations = relations(aiCoachConversations, ({ one }) => ({
  user: one(users, {
    fields: [aiCoachConversations.userId],
    references: [users.id],
  }),
  progress: one(workbookProgress, {
    fields: [aiCoachConversations.workbookId],
    references: [workbookProgress.id],
  }),
}));
