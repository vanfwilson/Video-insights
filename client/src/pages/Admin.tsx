import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, Users, Tv, Loader2, Pencil, Save, X } from "lucide-react";
import type { User, YoutubeChannel } from "@shared/models/auth";

type UserWithChannels = User & { channels: YoutubeChannel[]; defaultChannelId?: string | null };

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  
  // Dialog state - unified for both add and edit
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDialogMode, setUserDialogMode] = useState<"add" | "edit">("add");
  const [userDialogUserId, setUserDialogUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "search" as string,
    defaultChannelId: "" as string,
    notes: "" as string,
    channelIds: [] as string[],
  });
  
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithChannels | null>(null);
  
  // Inline notes editing state
  const [editingNotesUserId, setEditingNotesUserId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState("");

  const isSuperadmin = user?.role === "superadmin";

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithChannels[]>({
    queryKey: ["/api/admin/users"],
    enabled: isSuperadmin,
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery<YoutubeChannel[]>({
    queryKey: ["/api/admin/channels"],
    enabled: isSuperadmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; firstName?: string; lastName?: string; role: string; defaultChannelId?: string | null; notes?: string | null; channelIds?: string[] }) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      closeUserDialog();
      toast({ title: "User created successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      closeUserDialog();
      toast({ title: "User updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update user", variant: "destructive" });
    },
  });
  
  const updateNotesMutation = useMutation({
    mutationFn: async ({ userId, notes }: { userId: string; notes: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingNotesUserId(null);
      toast({ title: "Notes saved" });
    },
    onError: () => {
      toast({ title: "Failed to save notes", variant: "destructive" });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      return apiRequest("POST", "/api/admin/channels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channels"] });
      setNewChannelId("");
      setNewChannelName("");
      toast({ title: "Channel added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add channel", variant: "destructive" });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return apiRequest("DELETE", `/api/admin/channels/${channelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Channel deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete channel", variant: "destructive" });
    },
  });

  const assignChannelMutation = useMutation({
    mutationFn: async ({ userId, channelId }: { userId: string; channelId: string }) => {
      return apiRequest("POST", `/api/admin/users/${userId}/channels`, { channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Channel assigned" });
    },
    onError: () => {
      toast({ title: "Failed to assign channel", variant: "destructive" });
    },
  });

  const removeChannelMutation = useMutation({
    mutationFn: async ({ userId, channelId }: { userId: string; channelId: string }) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}/channels/${channelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Channel removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove channel", variant: "destructive" });
    },
  });
  
  const updateDefaultChannelMutation = useMutation({
    mutationFn: async ({ userId, channelId }: { userId: string; channelId: string | null }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/default-channel`, { channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Default channel updated" });
    },
    onError: () => {
      toast({ title: "Failed to update default channel", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteConfirmUser(null);
      toast({ title: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to delete user", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-500 mb-4">Only the superadmin can access user management.</p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddChannel = () => {
    if (newChannelId && newChannelName) {
      createChannelMutation.mutate({ id: newChannelId, name: newChannelName });
    }
  };

  const openAddUserDialog = () => {
    setUserDialogMode("add");
    setUserDialogUserId(null);
    setUserForm({
      email: "",
      firstName: "",
      lastName: "",
      role: "search",
      defaultChannelId: "__none__",
      notes: "",
      channelIds: [],
    });
    setUserDialogOpen(true);
  };
  
  const openEditUserDialog = (u: UserWithChannels) => {
    setUserDialogMode("edit");
    setUserDialogUserId(u.id);
    setUserForm({
      email: u.email || "",
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      role: u.role || "search",
      defaultChannelId: u.defaultChannelId || "__none__",
      notes: u.notes || "",
      channelIds: u.channels.map(ch => ch.id),
    });
    setUserDialogOpen(true);
  };
  
  const closeUserDialog = () => {
    setUserDialogOpen(false);
    setUserDialogUserId(null);
  };
  
  const handleSaveUser = () => {
    if (!userForm.email || !userForm.role) return;
    
    const effectiveDefaultChannelId = userForm.defaultChannelId === "__none__" ? null : (userForm.defaultChannelId || null);
    
    if (userDialogMode === "add") {
      createUserMutation.mutate({
        email: userForm.email,
        firstName: userForm.firstName || undefined,
        lastName: userForm.lastName || undefined,
        role: userForm.role,
        defaultChannelId: effectiveDefaultChannelId,
        notes: userForm.notes || null,
        channelIds: userForm.channelIds,
      });
    } else if (userDialogUserId) {
      updateUserMutation.mutate({
        userId: userDialogUserId,
        updates: {
          email: userForm.email,
          firstName: userForm.firstName || undefined,
          lastName: userForm.lastName || undefined,
          role: userForm.role,
          defaultChannelId: effectiveDefaultChannelId,
          notes: userForm.notes || null,
          channelIds: userForm.channelIds,
        },
      });
    }
  };
  
  const toggleChannelSelection = (channelId: string) => {
    setUserForm(prev => ({
      ...prev,
      channelIds: prev.channelIds.includes(channelId)
        ? prev.channelIds.filter(id => id !== channelId)
        : [...prev.channelIds, channelId],
    }));
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    return channel?.name || channelId;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-slate-600" />
              <CardTitle>YouTube Channels</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4 pb-4 border-b">
              <div className="space-y-2">
                <Label htmlFor="channel-id">Channel ID</Label>
                <Input
                  id="channel-id"
                  placeholder="UCa586yWZn..."
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  className="w-56"
                  data-testid="input-channel-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  placeholder="My Channel"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-56"
                  data-testid="input-channel-name"
                />
              </div>
              <Button
                onClick={handleAddChannel}
                disabled={!newChannelId || !newChannelName || createChannelMutation.isPending}
                data-testid="button-add-channel"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Channel
              </Button>
            </div>

            {channelsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : channels.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No channels configured yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <Badge
                    key={channel.id}
                    variant="secondary"
                    className="flex items-center gap-2 py-1.5 px-3"
                  >
                    <span data-testid={`text-channel-${channel.id}`}>{channel.name}</span>
                    <button
                      onClick={() => deleteChannelMutation.mutate(channel.id)}
                      className="text-slate-500 hover:text-red-500 transition-colors"
                      data-testid={`button-delete-channel-${channel.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              <CardTitle>Users & Channel Assignments</CardTitle>
            </div>
            <Button onClick={openAddUserDialog} data-testid="button-add-user">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No users found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Default Channel</TableHead>
                    <TableHead>Assigned Channels</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium">
                        {u.firstName} {u.lastName}
                      </TableCell>
                      <TableCell className="text-slate-500">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-role-${u.id}`}>
                          {u.role || "search"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.role === "creative" && u.defaultChannelId ? (
                          <Badge variant="secondary" data-testid={`badge-default-channel-${u.id}`}>
                            {getChannelName(u.defaultChannelId)}
                          </Badge>
                        ) : u.role === "creative" ? (
                          <span className="text-slate-400 text-sm">Not set</span>
                        ) : (
                          <span className="text-slate-400 text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.channels.map((ch) => (
                            <Badge
                              key={ch.id}
                              variant="outline"
                              data-testid={`badge-channel-${u.id}-${ch.id}`}
                            >
                              {ch.name}
                            </Badge>
                          ))}
                          {u.channels.length === 0 && (
                            <span className="text-slate-400 text-sm">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingNotesUserId === u.id ? (
                          <div className="flex items-center gap-1">
                            <Textarea
                              value={editingNotesValue}
                              onChange={(e) => setEditingNotesValue(e.target.value)}
                              className="min-w-[150px] text-sm"
                              rows={2}
                              data-testid={`textarea-notes-${u.id}`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateNotesMutation.mutate({ userId: u.id, notes: editingNotesValue })}
                              disabled={updateNotesMutation.isPending}
                              data-testid={`button-save-notes-${u.id}`}
                            >
                              <Save className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingNotesUserId(null)}
                              data-testid={`button-cancel-notes-${u.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="text-sm text-slate-600 cursor-pointer hover:bg-slate-100 rounded p-1 min-w-[100px] min-h-[24px]"
                            onClick={() => {
                              setEditingNotesUserId(u.id);
                              setEditingNotesValue(u.notes || "");
                            }}
                            data-testid={`text-notes-${u.id}`}
                          >
                            {u.notes || <span className="text-slate-400 italic">Click to add notes...</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditUserDialog(u)}
                            title="Edit user"
                            data-testid={`button-edit-${u.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirmUser(u)}
                            title="Delete user"
                            className="text-slate-400 hover:text-red-500"
                            data-testid={`button-delete-${u.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={userDialogOpen} onOpenChange={(open) => !open && closeUserDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{userDialogMode === "add" ? "Add New User" : "Edit User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                data-testid="input-user-email"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="user-first">First Name</Label>
                <Input
                  id="user-first"
                  placeholder="John"
                  value={userForm.firstName}
                  onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                  data-testid="input-user-first"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="user-last">Last Name</Label>
                <Input
                  id="user-last"
                  placeholder="Doe"
                  value={userForm.lastName}
                  onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                  data-testid="input-user-last"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={userForm.role} onValueChange={(role) => setUserForm({ ...userForm, role })}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="search">Search</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Channel {userForm.role === "creative" && "(Required for Creative)"}</Label>
              <Select 
                value={userForm.defaultChannelId} 
                onValueChange={(channelId) => setUserForm({ ...userForm, defaultChannelId: channelId })}
              >
                <SelectTrigger data-testid="select-user-default-channel">
                  <SelectValue placeholder="Select a channel..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {channels.filter(ch => ch.id).map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned Channels (Admin)</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                {channels.length === 0 ? (
                  <p className="text-slate-400 text-sm">No channels available</p>
                ) : (
                  channels.map((ch) => (
                    <div key={ch.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`channel-${ch.id}`}
                        checked={userForm.channelIds.includes(ch.id)}
                        onCheckedChange={() => toggleChannelSelection(ch.id)}
                        data-testid={`checkbox-channel-${ch.id}`}
                      />
                      <label 
                        htmlFor={`channel-${ch.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {ch.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-notes">Notes</Label>
              <Textarea
                id="user-notes"
                placeholder="Add notes about this user..."
                value={userForm.notes}
                onChange={(e) => setUserForm({ ...userForm, notes: e.target.value })}
                rows={3}
                data-testid="textarea-user-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUserDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={!userForm.email || !userForm.role || createUserMutation.isPending || updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : userDialogMode === "add" ? (
                <Plus className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {userDialogMode === "add" ? "Add User" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirmUser?.firstName} {deleteConfirmUser?.lastName} ({deleteConfirmUser?.email})? 
              This action cannot be undone and will remove all their channel assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmUser && deleteUserMutation.mutate(deleteConfirmUser.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
