import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronLeft, 
  Home, 
  X, 
  Check,
  RefreshCw,
  FileText,
  FileImage,
  FileVideo,
  FileAudio
} from "lucide-react";

interface DropboxFile {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder' | 'deleted';
  size?: number;
  modified?: string;
}

interface DropboxFileBrowserProps {
  onSelectFolder: (path: string, name: string) => void;
  onClose: () => void;
  isSelecting?: boolean;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <FileImage className="w-5 h-5 text-purple-400" />;
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) {
    return <FileVideo className="w-5 h-5 text-red-400" />;
  }
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) {
    return <FileAudio className="w-5 h-5 text-green-400" />;
  }
  if (['doc', 'docx', 'pdf', 'txt', 'md'].includes(ext || '')) {
    return <FileText className="w-5 h-5 text-blue-400" />;
  }
  return <File className="w-5 h-5 text-gray-400" />;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function DropboxFileBrowser({ onSelectFolder, onClose, isSelecting }: DropboxFileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>(['']);

  const { data: files = [], isLoading, error, refetch } = useQuery<DropboxFile[]>({
    queryKey: ['/api/dropbox/files', currentPath],
    queryFn: async () => {
      const response = await fetch(`/api/dropbox/files?path=${encodeURIComponent(currentPath)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load files');
      return response.json();
    },
  });

  const navigateToFolder = (path: string) => {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(path);
  };

  const goBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory];
      const previousPath = newHistory.pop() || '';
      setPathHistory(newHistory);
      setCurrentPath(previousPath);
    }
  };

  const goHome = () => {
    setPathHistory(['']);
    setCurrentPath('');
  };

  const currentFolderName = currentPath ? currentPath.split('/').pop() : 'Root';
  const folders = files.filter(f => f.type === 'folder');
  const regularFiles = files.filter(f => f.type === 'file');

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Folder className="w-5 h-5 text-blue-400" />
          Select Folder
        </CardTitle>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onClose}
          data-testid="button-close-browser"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={goHome}
            disabled={currentPath === ''}
            data-testid="button-home"
          >
            <Home className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={goBack}
            disabled={pathHistory.length <= 1}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-sm text-gray-400 truncate px-2">
            {currentPath || '/'}
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">
            <p>Failed to load files</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-2 rounded-lg hover-elevate cursor-pointer group"
                  onClick={() => navigateToFolder(folder.path)}
                  data-testid={`folder-${folder.name}`}
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-5 h-5 text-blue-400" />
                    <span className="text-sm">{folder.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
              {regularFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 rounded-lg opacity-60"
                  data-testid={`file-${file.name}`}
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.name)}
                    <span className="text-sm">{file.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
                </div>
              ))}
              {files.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>This folder is empty</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            Current: <span className="text-gray-300">{currentFolderName}</span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => onSelectFolder(currentPath, currentFolderName || 'Root')}
              disabled={isSelecting}
              data-testid="button-select-this-folder"
            >
              {isSelecting ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Select This Folder
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
