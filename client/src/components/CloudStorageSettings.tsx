import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Cloud, Check, RefreshCw, FolderOpen, ExternalLink } from "lucide-react";
import { SiDropbox } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DropboxFileBrowser } from "./DropboxFileBrowser";

interface DropboxStatus {
  connected: boolean;
  account?: {
    accountId: string;
    name: string;
    email: string;
    profilePhotoUrl?: string;
  };
}

interface CloudConnection {
  id: number;
  userId: string;
  provider: string;
  accountId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  profilePhotoUrl: string | null;
  selectedFolderPath: string | null;
  selectedFolderName: string | null;
  isActive: string | null;
  lastSyncedAt: string | null;
}

export function CloudStorageSettings() {
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const { data: dropboxStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery<DropboxStatus>({
    queryKey: ['/api/dropbox/status'],
  });

  const { data: connections = [] } = useQuery<CloudConnection[]>({
    queryKey: ['/api/cloud-connections'],
  });

  const dropboxConnection = connections.find(c => c.provider === 'dropbox');

  const connectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/dropbox/connect', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cloud-connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dropbox/status'] });
    },
  });

  const selectFolderMutation = useMutation({
    mutationFn: (data: { folderPath: string; folderName: string }) => 
      apiRequest('POST', '/api/dropbox/select-folder', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cloud-connections'] });
      setShowFolderPicker(false);
    },
  });

  const handleConnect = async () => {
    if (dropboxStatus?.connected) {
      await connectMutation.mutateAsync();
    }
  };

  const handleFolderSelect = (folderPath: string, folderName: string) => {
    selectFolderMutation.mutate({ folderPath, folderName });
  };

  if (loadingStatus) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Cloud Storage
          </CardTitle>
          <CardDescription>
            Connect your cloud storage accounts to access your files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <SiDropbox className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-medium">Dropbox</h4>
                {dropboxStatus?.connected && dropboxStatus.account ? (
                  <p className="text-sm text-gray-400">{dropboxStatus.account.email}</p>
                ) : (
                  <p className="text-sm text-gray-400">Not connected</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dropboxStatus?.connected ? (
                <>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                  {!dropboxConnection && (
                    <Button 
                      size="sm" 
                      onClick={handleConnect}
                      disabled={connectMutation.isPending}
                      data-testid="button-save-dropbox"
                    >
                      {connectMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Connection"
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="bg-gray-700 text-gray-400 border-gray-600">
                  Not Connected
                </Badge>
              )}
            </div>
          </div>

          {dropboxConnection && (
            <div className="p-4 bg-gray-800/50 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {dropboxConnection.profilePhotoUrl && (
                    <AvatarImage src={dropboxConnection.profilePhotoUrl} />
                  )}
                  <AvatarFallback className="bg-blue-600">
                    {dropboxConnection.accountName?.charAt(0) || 'D'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{dropboxConnection.accountName}</p>
                  <p className="text-sm text-gray-400">{dropboxConnection.accountEmail}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    {dropboxConnection.selectedFolderPath ? (
                      <span className="text-gray-300">{dropboxConnection.selectedFolderName || dropboxConnection.selectedFolderPath}</span>
                    ) : (
                      <span className="text-gray-500">No folder selected</span>
                    )}
                  </span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowFolderPicker(true)}
                  data-testid="button-select-folder"
                >
                  {dropboxConnection.selectedFolderPath ? "Change Folder" : "Select Folder"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showFolderPicker && dropboxStatus?.connected && (
        <DropboxFileBrowser
          onSelectFolder={handleFolderSelect}
          onClose={() => setShowFolderPicker(false)}
          isSelecting={selectFolderMutation.isPending}
        />
      )}
    </div>
  );
}
