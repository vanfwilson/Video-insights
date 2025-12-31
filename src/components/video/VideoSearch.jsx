import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function VideoSearch({ videos, onFilteredResults }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');

    React.useEffect(() => {
        filterVideos();
    }, [searchQuery, statusFilter, dateFilter, sortBy, videos]);

    const filterVideos = () => {
        let filtered = [...videos];

        // Search query (fuzzy matching on title and description)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(video => {
                const title = (video.title || '').toLowerCase();
                const description = (video.description || '').toLowerCase();
                
                // Fuzzy match: check if all query words appear in title or description
                const queryWords = query.split(' ').filter(w => w.length > 0);
                return queryWords.every(word => 
                    title.includes(word) || description.includes(word)
                );
            });
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(v => v.status === statusFilter);
        }

        // Date filter
        if (dateFilter !== 'all') {
            const now = new Date();
            filtered = filtered.filter(v => {
                const uploadDate = new Date(v.created_date);
                const daysDiff = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
                
                if (dateFilter === 'today') return daysDiff === 0;
                if (dateFilter === 'week') return daysDiff <= 7;
                if (dateFilter === 'month') return daysDiff <= 30;
                if (dateFilter === '3months') return daysDiff <= 90;
                return true;
            });
        }

        // Sort
        filtered.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.created_date) - new Date(a.created_date);
            } else if (sortBy === 'oldest') {
                return new Date(a.created_date) - new Date(b.created_date);
            } else if (sortBy === 'title') {
                return (a.title || '').localeCompare(b.title || '');
            }
            return 0;
        });

        onFilteredResults(filtered);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setDateFilter('all');
        setSortBy('newest');
    };

    const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || sortBy !== 'newest';

    return (
        <Card className="mb-6">
            <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search Input */}
                    <div className="lg:col-span-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search by title or description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="ready_to_publish">Ready to Publish</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Date Filter */}
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Upload Date" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">Last 7 Days</SelectItem>
                            <SelectItem value="month">Last 30 Days</SelectItem>
                            <SelectItem value="3months">Last 3 Months</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Sort and Clear */}
                <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Sort by:</span>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                                <SelectItem value="title">Title A-Z</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="ml-auto"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Clear Filters
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}