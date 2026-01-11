import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertCircle, Clock, UploadCloud, FileText, Youtube } from "lucide-react";

type Status = "uploading" | "transcribing" | "generating_metadata" | "ready_to_edit" | "publishing" | "published" | "failed";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    uploading: { 
      icon: UploadCloud, 
      label: "Uploading", 
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100"
    },
    transcribing: { 
      icon: FileText, 
      label: "Transcribing", 
      color: "text-purple-600",
      bg: "bg-purple-50 border-purple-100"
    },
    generating_metadata: { 
      icon: Loader2, 
      label: "AI Magic", 
      color: "text-pink-600",
      bg: "bg-pink-50 border-pink-100"
    },
    ready_to_edit: { 
      icon: Clock, 
      label: "Draft", 
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-100"
    },
    publishing: { 
      icon: Loader2, 
      label: "Publishing", 
      color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-100"
    },
    published: { 
      icon: Youtube, 
      label: "Published", 
      color: "text-green-600",
      bg: "bg-green-50 border-green-100"
    },
    failed: { 
      icon: AlertCircle, 
      label: "Failed", 
      color: "text-red-600",
      bg: "bg-red-50 border-red-100"
    },
  };

  const current = config[status] || { icon: AlertCircle, label: status, color: "text-gray-600", bg: "bg-gray-50 border-gray-100" };
  const Icon = current.icon;
  const isSpinning = ["uploading", "transcribing", "generating_metadata", "publishing"].includes(status);

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm",
      current.bg,
      current.color,
      className
    )}>
      <Icon className={cn("w-3.5 h-3.5", isSpinning && "animate-spin")} />
      <span>{current.label}</span>
    </div>
  );
}
