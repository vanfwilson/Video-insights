import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function UserManagement() {
    const [email, setEmail] = useState('');
    const [appRole, setAppRole] = useState('search_user');
    const [inviting, setInviting] = useState(false);
    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list()
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('User role updated');
        }
    });

    const handleInvite = async () => {
        if (!email) {
            toast.error('Please enter an email');
            return;
        }

        setInviting(true);
        try {
            await base44.users.inviteUser(email, 'user');
            
            // Wait a moment for user to be created, then update their app_role
            setTimeout(async () => {
                const newUsers = await base44.entities.User.filter({ email });
                if (newUsers.length > 0) {
                    await base44.entities.User.update(newUsers[0].id, { app_role: appRole });
                    queryClient.invalidateQueries({ queryKey: ['users'] });
                }
            }, 2000);

            toast.success(`Invitation sent to ${email}`);
            setEmail('');
            setAppRole('search_user');
        } catch (error) {
            toast.error('Invitation failed: ' + error.message);
        } finally {
            setInviting(false);
        }
    };

    const roleColors = {
        admin: 'bg-purple-100 text-purple-800',
        creator: 'bg-blue-100 text-blue-800',
        search_user: 'bg-gray-100 text-gray-800'
    };

    const roleDescriptions = {
        admin: 'Full access - manage uploads, security, clips',
        creator: 'Create and publish clips from existing videos',
        search_user: 'Search and view published content only'
    };

    if (currentUser?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
                            <p className="text-gray-600">
                                You need admin privileges to manage users
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
                    <p className="text-gray-600">Invite users and manage their roles</p>
                </div>

                {/* Invite User */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="w-5 h-5" />
                            Invite New User
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label htmlFor="role">Application Role</Label>
                                <Select value={appRole} onValueChange={setAppRole}>
                                    <SelectTrigger className="mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Admin - Full Access</SelectItem>
                                        <SelectItem value="creator">Creator - Manage Clips</SelectItem>
                                        <SelectItem value="search_user">Search User - View Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button onClick={handleInvite} disabled={inviting} className="w-full">
                            <Mail className="w-4 h-4 mr-2" />
                            {inviting ? 'Sending...' : 'Send Invitation'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Role Descriptions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Role Permissions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.entries(roleDescriptions).map(([role, description]) => (
                            <div key={role} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Badge className={roleColors[role]}>{role.replace('_', ' ')}</Badge>
                                <p className="text-sm text-gray-600">{description}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Existing Users */}
                <Card>
                    <CardHeader>
                        <CardTitle>Existing Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {users.map((user) => (
                                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex-1">
                                        <div className="font-semibold">{user.full_name || user.email}</div>
                                        <div className="text-sm text-gray-600">{user.email}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className={roleColors[user.app_role || 'search_user']}>
                                            {(user.app_role || 'search_user').replace('_', ' ')}
                                        </Badge>
                                        {user.email !== currentUser?.email && (
                                            <Select
                                                value={user.app_role || 'search_user'}
                                                onValueChange={(value) => 
                                                    updateUserMutation.mutate({ id: user.id, data: { app_role: value } })
                                                }
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                    <SelectItem value="creator">Creator</SelectItem>
                                                    <SelectItem value="search_user">Search User</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}