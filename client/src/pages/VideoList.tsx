import { useVideos } from "@/hooks/use-videos";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Plus, Video as VideoIcon, Calendar, ArrowRight, Settings, Users, Download, Cloud } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function VideoList() {
  const { data: videos, isLoading } = useVideos();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const isSuperadmin = user?.role === "superadmin";
  const isSearchOnly = user?.role === "search";

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading your library...</p>
        </div>
      </div>
    );
  }
  
  // Block search role users - they only have search access
  if (isSearchOnly) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Search Access Only</h2>
          <p className="text-slate-500 mb-4">Your account only has search access. Contact an admin for video permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <VideoIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Video Studio</h1>
          </div>
          <div className="flex items-center gap-3">
            {isSuperadmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    data-testid="button-settings-menu"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setLocation("/admin")}
                    data-testid="menu-item-users"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Users
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      window.open('/api/admin/export-csv', '_blank');
                    }}
                    data-testid="menu-item-export-csv"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Data (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => setLocation("/cloud-storage")}
              data-testid="button-cloud-storage"
            >
              <Cloud className="w-5 h-5" />
            </Button>
            <Link href="/upload">
              <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95">
                <Plus className="w-5 h-5" />
                <span>New Upload</span>
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!videos || videos.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <VideoIcon className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 font-display">No videos yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-8">
              Upload a video to get started with AI-powered transcription and publishing.
            </p>
            <Link href="/upload">
              <button className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all">
                Upload Your First Video
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video, idx) => (
              <motion.div 
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link href={`/videos/${video.id}`} className="block group h-full">
                  <div className="bg-white h-full rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 group-hover:-translate-y-1">
                    {/* Thumbnail Area */}
                    <div className="aspect-video bg-slate-100 relative overflow-hidden">
                      {video.thumbnailUrl ? (
                        <img 
                          src={video.thumbnailUrl} 
                          alt={video.title || "Thumbnail"} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                          <VideoIcon className="w-12 h-12 mb-2 opacity-50" />
                          <span className="text-sm font-medium">No Thumbnail</span>
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <StatusBadge status={video.status} className="bg-white/90 backdrop-blur-sm shadow-sm" />
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-5 flex flex-col gap-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-slate-900 group-hover:text-primary transition-colors line-clamp-1 mb-1">
                          {video.title || video.originalFilename}
                        </h3>
                        <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5em]">
                          {video.description || "No description generated yet."}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {video.createdAt ? format(new Date(video.createdAt), 'MMM d, yyyy') : 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1 text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                          Edit Video <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
