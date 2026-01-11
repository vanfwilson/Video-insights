import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

// Fetch Clerk config and initialize app
async function initApp() {
  let publishableKey: string;
  
  try {
    const response = await fetch('/api/clerk-config');
    const config = await response.json();
    publishableKey = config.publishableKey;
  } catch (error) {
    console.error('Failed to fetch Clerk config:', error);
    // Fallback to env variable
    publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  }
  
  if (!publishableKey) {
    console.error('Missing Clerk Publishable Key');
    document.getElementById("root")!.innerHTML = '<div style="padding:20px;color:red;">Authentication configuration error. Please contact support.</div>';
    return;
  }

  createRoot(document.getElementById("root")!).render(
    <ClerkProvider publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  );
}

initApp();
