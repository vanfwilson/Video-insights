import { clerkMiddleware, getAuth, requireAuth, createClerkClient } from "@clerk/express";
import type { Express, RequestHandler, Request } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Single production Clerk client
const clerkClient = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

// Get Clerk client (single instance)
export function getClerkClientForRequest(req: Request) {
  return clerkClient;
}

export function setupClerkAuth(app: Express) {
  // Single Clerk instance - uses CLERK_SECRET_KEY from environment
  // Add all domains (including Replit preview) to Clerk dashboard's allowed origins
  app.use(clerkMiddleware());
  
  console.log("[Clerk] Auth configured with production keys");
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  
  if (!auth.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  next();
};

// Upsert user to database (used by auth routes)
async function upsertUserToDb(userData: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}) {
  const existing = await db.select().from(users).where(eq(users.id, userData.id));
  
  if (existing.length > 0) {
    await db.update(users)
      .set({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userData.id));
  } else {
    await db.insert(users).values({
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      role: "creative", // Default role for new users
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// Middleware that also upserts the user to our database
export const isAuthenticatedWithSync: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  
  if (!auth.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    // Get user details from Clerk (use appropriate client for domain)
    const client = getClerkClientForRequest(req);
    const clerkUser = await client.users.getUser(auth.userId);
    
    // Upsert user to our database
    await upsertUserToDb({
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || null,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      profileImageUrl: clerkUser.imageUrl,
    });
    
    // Attach user info to request
    (req as any).clerkUser = clerkUser;
    (req as any).userId = auth.userId;
  } catch (error) {
    console.error("Error syncing user:", error);
    // Continue even if sync fails
  }
  
  next();
};

// Helper to get userId from request
export function getUserId(req: any): string | null {
  const auth = getAuth(req);
  return auth.userId;
}

// Helper to get full user from Clerk
export async function getClerkUser(req: any) {
  const auth = getAuth(req);
  if (!auth.userId) return null;
  const client = getClerkClientForRequest(req);
  return client.users.getUser(auth.userId);
}

// Get user from our database (includes role)
export async function getUserFromDb(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user || null;
}

export { getAuth, requireAuth, upsertUserToDb };
