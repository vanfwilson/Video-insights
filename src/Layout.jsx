import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Video, Search, Users, LogOut } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const isAdmin = currentUser?.role === 'admin' || currentUser?.app_role === 'admin';
    const isCreator = isAdmin || currentUser?.app_role === 'creator';

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <h1 className="text-xl font-bold text-gray-900">Video Hub</h1>
                            <div className="flex gap-2">
                                <Link to={createPageUrl('ClientSearch')}>
                                    <Button variant={currentPageName === 'ClientSearch' ? 'default' : 'ghost'} size="sm">
                                        <Search className="w-4 h-4 mr-2" />
                                        Search
                                    </Button>
                                </Link>
                                {isCreator && (
                                    <Link to={createPageUrl('ClipManagement')}>
                                        <Button variant={currentPageName === 'ClipManagement' ? 'default' : 'ghost'} size="sm">
                                            <Video className="w-4 h-4 mr-2" />
                                            Clips
                                        </Button>
                                    </Link>
                                )}
                                {isAdmin && (
                                    <>
                                        <Link to={createPageUrl('AdminDashboard')}>
                                            <Button variant={currentPageName === 'AdminDashboard' ? 'default' : 'ghost'} size="sm">
                                                <Video className="w-4 h-4 mr-2" />
                                                Dashboard
                                            </Button>
                                        </Link>
                                        <Link to={createPageUrl('UserManagement')}>
                                            <Button variant={currentPageName === 'UserManagement' ? 'default' : 'ghost'} size="sm">
                                                <Users className="w-4 h-4 mr-2" />
                                                Users
                                            </Button>
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {currentUser && (
                                <>
                                    <div className="text-right">
                                        <div className="text-sm font-medium">{currentUser.full_name}</div>
                                        <div className="text-xs text-gray-500">
                                            {currentUser.app_role || 'search_user'}
                                        </div>
                                    </div>
                                    <Button onClick={() => base44.auth.logout()} variant="outline" size="sm">
                                        <LogOut className="w-4 h-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            <main>
                {children}
            </main>
        </div>
    );
}