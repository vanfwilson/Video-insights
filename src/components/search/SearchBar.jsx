import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from 'lucide-react';

export default function SearchBar({ onSearch, loading }) {
    const [query, setQuery] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for training topics, situations, or questions..."
                    className="pl-10 h-12 text-lg"
                />
            </div>
            <Button type="submit" size="lg" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </Button>
        </form>
    );
}