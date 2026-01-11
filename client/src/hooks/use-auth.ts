import { useUser, useClerk } from "@clerk/clerk-react";
import type { User } from "@shared/models/auth";

export function useAuth() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  // Map Clerk user to our User type
  const user: User | null = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || null,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    profileImageUrl: clerkUser.imageUrl,
    role: (clerkUser.publicMetadata?.role as User["role"]) || "creative",
    defaultChannelId: null,
    notes: null,
    createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt) : new Date(),
    updatedAt: clerkUser.updatedAt ? new Date(clerkUser.updatedAt) : new Date(),
  } : null;

  return {
    user,
    isLoading: !isLoaded,
    isAuthenticated: !!isSignedIn,
    logout: signOut,
    isLoggingOut: false,
  };
}
