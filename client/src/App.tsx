import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { SignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import RoleBasedLayout, { canAccessRoute, getDefaultRoute } from "@/components/RoleBasedLayout";

import NotFound from "@/pages/not-found";
import VideoList from "@/pages/VideoList";
import Upload from "@/pages/Upload";
import VideoEditor from "@/pages/VideoEditor";
import Admin from "@/pages/Admin";
import CloudStorage from "@/pages/CloudStorage";
import VideoIngestProgress from "@/pages/VideoIngestProgress";
import WorkbookDashboard from "@/pages/WorkbookDashboard";
import WorkbookCoreValue from "@/pages/WorkbookCoreValue";
import WorkbookSWOT from "@/pages/WorkbookSWOT";
import WorkbookRootCause from "@/pages/WorkbookRootCause";
import WorkbookTimeAudit from "@/pages/WorkbookTimeAudit";
import WorkbookActionPlan from "@/pages/WorkbookActionPlan";
import Leads from "@/pages/Leads";
import SwotAnalysisPage from "@/pages/SwotAnalysisPage";
import SemanticSearch from "@/pages/SemanticSearch";
import ClipReview from "@/pages/ClipReview";
import VideoWorkflow from "@/pages/VideoWorkflow";

type UserRole = "superadmin" | "admin" | "creative" | "search" | "pickone" | undefined;

function RouteGuard({ 
  component: Component, 
  path 
}: { 
  component: React.ComponentType; 
  path: string;
}) {
  const { user } = useAuth();
  const userRole = user?.role as UserRole;
  
  if (!canAccessRoute(userRole, path)) {
    const defaultRoute = getDefaultRoute(userRole);
    return <Redirect to={defaultRoute} />;
  }
  
  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <h1 className="text-3xl font-bold font-display text-slate-900 mb-2">Video Studio AI</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Automate your video workflow. Upload, transcribe, generate metadata, and publish to YouTube in minutes.
          </p>
          <SignIn 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 p-0 w-full",
              }
            }}
          />
        </div>
      </div>
    );
  }

  const isPickoneUser = user.role === "pickone";
  const userRole = user?.role as UserRole;

  if (isPickoneUser) {
    return (
      <Switch>
        <Route path="/" component={WorkbookDashboard} />
        <Route path="/workbook" component={WorkbookDashboard} />
        <Route path="/workbook/core-value" component={WorkbookCoreValue} />
        <Route path="/workbook/swot" component={WorkbookSWOT} />
        <Route path="/workbook/root-cause" component={WorkbookRootCause} />
        <Route path="/workbook/time-audit" component={WorkbookTimeAudit} />
        <Route path="/workbook/action-plan" component={WorkbookActionPlan} />
        <Route path="/cloud-storage" component={CloudStorage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (location === "/" && userRole === "search") {
    return <Redirect to="/search" />;
  }

  return (
    <RoleBasedLayout>
      <Switch>
        <Route path="/">
          <RouteGuard component={VideoList} path="/" />
        </Route>
        <Route path="/upload">
          <RouteGuard component={Upload} path="/upload" />
        </Route>
        <Route path="/cloud-storage">
          <RouteGuard component={CloudStorage} path="/cloud-storage" />
        </Route>
        <Route path="/import-progress">
          <RouteGuard component={VideoIngestProgress} path="/import-progress" />
        </Route>
        <Route path="/search">
          <RouteGuard component={SemanticSearch} path="/search" />
        </Route>
        <Route path="/leads">
          <RouteGuard component={Leads} path="/leads" />
        </Route>
        <Route path="/leads/list">
          <RouteGuard component={Leads} path="/leads/list" />
        </Route>
        <Route path="/leads/view/:id">
          {() => <RouteGuard component={Leads} path="/leads/view/:id" />}
        </Route>
        <Route path="/swot">
          <RouteGuard component={SwotAnalysisPage} path="/swot" />
        </Route>
        <Route path="/videos/:id">
          {() => <RouteGuard component={() => <VideoEditor />} path="/videos/:id" />}
        </Route>
        <Route path="/admin">
          <RouteGuard component={Admin} path="/admin" />
        </Route>
        <Route path="/admin/workflow">
          <RouteGuard component={VideoWorkflow} path="/admin/workflow" />
        </Route>
        <Route path="/videos/:id/clips">
          {() => <RouteGuard component={ClipReview} path="/videos/:id/clips" />}
        </Route>
        <Route path="/profile">
          <ComingSoonPage />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoleBasedLayout>
  );
}

function ComingSoonPage() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Coming Soon</h2>
        <p className="text-slate-500">This feature is being restored. Check back shortly.</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
