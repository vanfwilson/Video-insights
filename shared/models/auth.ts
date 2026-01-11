import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User roles for the app
// superadmin: Full access including user management (only vanwilson)
// admin: Can create/publish videos with channel selector
// creative: Can create/publish videos to their assigned default channel only
// search: Only access to search page
// pickone: Access to Pick One Workbook features (no video publisher access)
export const userRoles = ["superadmin", "admin", "creative", "search", "pickone"] as const;
export type UserRole = typeof userRoles[number];

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: userRoles }).default("search"),
  defaultChannelId: varchar("default_channel_id").references(() => youtubeChannels.id),
  notes: varchar("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// YouTube channels that users can publish to
export const youtubeChannels = pgTable("youtube_channels", {
  id: varchar("id").primaryKey(), // YouTube channel ID (e.g., UCa586yWZnTTfLXtZNTa5vBw)
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type YoutubeChannel = typeof youtubeChannels.$inferSelect;
export type InsertYoutubeChannel = typeof youtubeChannels.$inferInsert;

// Junction table: which users can publish to which channels
export const userChannels = pgTable("user_channels", {
  userId: varchar("user_id").references(() => users.id).notNull(),
  channelId: varchar("channel_id").references(() => youtubeChannels.id).notNull(),
}, (table) => [
  {
    pk: primaryKey({ columns: [table.userId, table.channelId] }),
  }
]);

export type UserChannel = typeof userChannels.$inferSelect;
export type InsertUserChannel = typeof userChannels.$inferInsert;
