import { useState, useRef } from "react";
import { useUploadVideo } from "@/hooks/use-videos";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { UploadCloud, ArrowLeft, FileVideo, AlertCircle, Loader2, HardDrive, ListTodo } from "lucide-react";
import { SiDropbox } from "react-icons/si";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CloudVideoSelector } from "@/components/CloudVideoSelector";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("local");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: upload, isPending } = useUploadVideo();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const isSearchOnly = user?.role === "search";
  
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }
  
  // Block search role users
  if (isSearchOnly) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500 mb-4">Your account only has search access. Contact an admin for upload permissions.</p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const handleFile = (selectedFile: File) => {
    if (selectedFile.type.startsWith("video/")) {
      setFile(selectedFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file (MP4, MOV, etc.)",
        variant: "destructive",
      });
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    upload(formData, {
      onSuccess: (video) => {
        toast({
          title: "Upload started!",
          description: "We're processing your video now.",
        });
        setLocation(`/videos/${video.id}`);
      },
      onError: (error) => {
        toast({
          title: "Upload failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
          </Link>
          <Link href="/import-progress">
            <Button variant="outline" size="sm" data-testid="link-import-progress">
              <ListTodo className="w-4 h-4 mr-2" />
              Import Progress
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 pt-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold font-display text-slate-900 mb-3">Add Videos</h1>
            <p className="text-slate-500">Upload videos from your device or import from cloud storage.</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="local" className="flex items-center gap-2" data-testid="tab-local-upload">
                <HardDrive className="w-4 h-4" />
                From Device
              </TabsTrigger>
              <TabsTrigger value="cloud" className="flex items-center gap-2" data-testid="tab-cloud-import">
                <SiDropbox className="w-4 h-4 text-blue-600" />
                From Dropbox
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="local" className="mt-0">
              <div
                className={cn(
                  "relative group rounded-3xl border-3 border-dashed transition-all duration-300 p-10 text-center bg-white shadow-sm cursor-pointer",
                  dragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50",
                  file && "border-primary/50 bg-primary/5"
                )}
                onDragEnter={onDrag}
                onDragLeave={onDrag}
                onDragOver={onDrag}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                data-testid="dropzone-local"
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept="video/*"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  data-testid="input-file"
                />

                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-colors",
                    file ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                  )}>
                    {file ? <FileVideo className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
                  </div>
                  
                  <div className="space-y-1">
                    {file ? (
                      <>
                        <p className="text-lg font-bold text-slate-900">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-slate-900">Click to upload or drag and drop</p>
                        <p className="text-sm text-slate-500">MP4, MOV or AVI (max 500MB)</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleSubmit}
                  disabled={!file || isPending}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all",
                    !file || isPending
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-primary text-white hover:bg-primary/90 hover:shadow-primary/25 hover:-translate-y-0.5 active:scale-95"
                  )}
                  data-testid="button-start-processing"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    "Start Processing"
                  )}
                </button>
              </div>
              
              <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>
                  Once uploaded, we'll automatically transcribe your video and use AI to generate a title, description, and tags. This may take a few minutes.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="cloud" className="mt-0">
              <div className="bg-white rounded-2xl border p-6">
                <CloudVideoSelector 
                  onProcessStart={() => setLocation('/import-progress')}
                />
              </div>
              
              <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
                <Link href="/cloud-storage">
                  <Button variant="outline" data-testid="link-manage-storage">
                    Manage Cloud Storage
                  </Button>
                </Link>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
