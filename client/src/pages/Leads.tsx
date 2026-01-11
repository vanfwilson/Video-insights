import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, Trash2, Loader2, Search, Building2, MapPin, Globe, 
  Phone, Mail, Star, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, Calendar, Clock, Lightbulb, List, Users, Target, Handshake, Info
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { BusinessType } from "@shared/schema";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwotAnalysis } from "@/components/SwotAnalysis";
import type { ClientBusiness, LeadSearch, LeadBusiness, LeadSearchSchedule, LeadsSwotAnalysis } from "@shared/schema";

export default function Leads() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ClientBusiness | null>(null);
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [searchDialogClient, setSearchDialogClient] = useState<ClientBusiness | null>(null);
  const [searchOptions, setSearchOptions] = useState({
    searchTypes: ["ideal_customer", "competitor", "partner"] as string[],
    verifyEmails: false,
  });
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    googleBusinessUrl: "",
    keyword: "",
    zipCode: "",
    city: "",
    state: "",
    notes: "",
    businessType: "ideal_customer" as BusinessType,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<ClientBusiness[]>({
    queryKey: ["/api/leads/clients"],
    enabled: !!user,
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/leads/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/clients"] });
      setAddDialogOpen(false);
      resetForm();
      toast({ title: "Client business added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add client", description: error.message, variant: "destructive" });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/leads/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/clients"] });
      setDeleteConfirm(null);
      toast({ title: "Client business deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete client", description: error.message, variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async ({ clientId, options }: { clientId: number; options: typeof searchOptions }) => {
      return apiRequest("POST", `/api/leads/clients/${clientId}/search`, {
        searchTypes: options.searchTypes,
        verifyEmails: options.verifyEmails,
      });
    },
    onSuccess: (data: any, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/clients", clientId, "searches"] });
      setSearchDialogClient(null);
      if (data.message) {
        toast({ title: "Search initiated", description: data.message });
      } else {
        toast({ title: "Search started" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSearch = (client: ClientBusiness) => {
    setSearchDialogClient(client);
    setSearchOptions({
      searchTypes: ["ideal_customer", "competitor", "partner"],
      verifyEmails: false,
    });
  };

  const toggleSearchType = (type: string) => {
    setSearchOptions(prev => {
      const types = prev.searchTypes.includes(type)
        ? prev.searchTypes.filter(t => t !== type)
        : [...prev.searchTypes, type];
      return { ...prev, searchTypes: types.length > 0 ? types : [type] };
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      googleBusinessUrl: "",
      keyword: "",
      zipCode: "",
      city: "",
      state: "",
      notes: "",
      businessType: "ideal_customer" as BusinessType,
    });
  };

  const getBusinessTypeLabel = (type: BusinessType) => {
    switch (type) {
      case "ideal_customer": return "Ideal Customer";
      case "competitor": return "Competitor";
      case "partnering_prospect": return "Partnering Prospect";
      default: return type;
    }
  };

  const getBusinessTypeIcon = (type: BusinessType) => {
    switch (type) {
      case "ideal_customer": return Target;
      case "competitor": return Users;
      case "partnering_prospect": return Handshake;
      default: return Building2;
    }
  };

  const getBusinessTypeBadgeVariant = (type: BusinessType): "default" | "secondary" | "outline" => {
    switch (type) {
      case "ideal_customer": return "default";
      case "competitor": return "secondary";
      case "partnering_prospect": return "outline";
      default: return "secondary";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.keyword) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createClientMutation.mutate(formData);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Local Business Research</h1>
          <p className="text-muted-foreground">Find and analyze businesses in your target market</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/leads/list")} data-testid="button-view-all-leads">
            <List className="w-4 h-4 mr-2" />
            View All Leads
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-client">
            <Plus className="w-4 h-4 mr-2" />
            Add Client Business
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Use this tool to research businesses in three categories:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Ideal Customers</p>
                <p className="text-xs text-muted-foreground">Businesses that fit your target customer profile</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Competitors</p>
                <p className="text-xs text-muted-foreground">Similar businesses to monitor and analyze</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Handshake className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Partnering Prospects</p>
                <p className="text-xs text-muted-foreground">Professionals for mutual referrals (e.g., florists + wedding planners)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {clientsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No client businesses yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add a client business to start finding local leads and competitors
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              isExpanded={expandedClient === client.id}
              onToggle={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
              onDelete={() => setDeleteConfirm(client)}
              onSearch={() => handleSearch(client)}
              isSearching={searchMutation.isPending}
            />
          ))}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Client Business</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Smith's Florist Shop"
                data-testid="input-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyword">Business Type / Keyword *</Label>
              <Input
                id="keyword"
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                placeholder="e.g., florist, dentist, pizza restaurant"
                data-testid="input-client-keyword"
              />
              <p className="text-xs text-muted-foreground">
                This is used to search for similar businesses nearby
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State 12345"
                data-testid="input-client-address"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  placeholder="12345"
                  data-testid="input-client-zip"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  data-testid="input-client-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="CA"
                  data-testid="input-client-state"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="googleBusinessUrl">Google Business URL (optional)</Label>
              <Input
                id="googleBusinessUrl"
                value={formData.googleBusinessUrl}
                onChange={(e) => setFormData({ ...formData, googleBusinessUrl: e.target.value })}
                placeholder="https://g.page/..."
                data-testid="input-client-google-url"
              />
            </div>
            <div className="space-y-3">
              <Label>Research Type *</Label>
              <RadioGroup 
                value={formData.businessType} 
                onValueChange={(value) => setFormData({ ...formData, businessType: value as BusinessType })}
                className="grid grid-cols-1 gap-2"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-md hover-elevate cursor-pointer" onClick={() => setFormData({ ...formData, businessType: "ideal_customer" })}>
                  <RadioGroupItem value="ideal_customer" id="type-ideal" data-testid="radio-ideal-customer" />
                  <Label htmlFor="type-ideal" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Target className="w-4 h-4 text-primary" />
                    <div>
                      <span className="font-medium">Ideal Customer</span>
                      <p className="text-xs text-muted-foreground">Businesses that fit your target customer profile</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-md hover-elevate cursor-pointer" onClick={() => setFormData({ ...formData, businessType: "competitor" })}>
                  <RadioGroupItem value="competitor" id="type-competitor" data-testid="radio-competitor" />
                  <Label htmlFor="type-competitor" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">Competitor</span>
                      <p className="text-xs text-muted-foreground">Similar businesses to monitor and analyze</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-md hover-elevate cursor-pointer" onClick={() => setFormData({ ...formData, businessType: "partnering_prospect" })}>
                  <RadioGroupItem value="partnering_prospect" id="type-partner" data-testid="radio-partnering-prospect" />
                  <Label htmlFor="type-partner" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Handshake className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">Partnering Prospect</span>
                      <p className="text-xs text-muted-foreground">Professionals for mutual referrals</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this client..."
                data-testid="input-client-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createClientMutation.isPending} data-testid="button-submit-client">
                {createClientMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client Business?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteConfirm?.name}" and all associated search results.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteClientMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClientMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!searchDialogClient} onOpenChange={(open) => !open && setSearchDialogClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Search Options</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">What to search for:</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="search-ideal"
                    checked={searchOptions.searchTypes.includes("ideal_customer")}
                    onCheckedChange={() => toggleSearchType("ideal_customer")}
                    data-testid="checkbox-search-ideal"
                  />
                  <label htmlFor="search-ideal" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Target className="w-4 h-4 text-primary" />
                    Ideal Customers
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="search-competitor"
                    checked={searchOptions.searchTypes.includes("competitor")}
                    onCheckedChange={() => toggleSearchType("competitor")}
                    data-testid="checkbox-search-competitor"
                  />
                  <label htmlFor="search-competitor" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Competitors
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="search-partner"
                    checked={searchOptions.searchTypes.includes("partner")}
                    onCheckedChange={() => toggleSearchType("partner")}
                    data-testid="checkbox-search-partner"
                  />
                  <label htmlFor="search-partner" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Handshake className="w-4 h-4 text-muted-foreground" />
                    Partnering Prospects
                  </label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                All 3 = 1x cost. Solo = 3x.
              </p>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="verify-emails"
                  checked={searchOptions.verifyEmails}
                  onCheckedChange={(checked) => setSearchOptions(prev => ({ ...prev, verifyEmails: !!checked }))}
                  data-testid="checkbox-verify-emails"
                />
                <label htmlFor="verify-emails" className="flex items-center gap-2 text-sm cursor-pointer">
                  <Mail className="w-4 h-4" />
                  Verify emails
                </label>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Extra cost per email verified.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchDialogClient(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => searchDialogClient && searchMutation.mutate({ 
                clientId: searchDialogClient.id, 
                options: searchOptions 
              })}
              disabled={searchMutation.isPending || searchOptions.searchTypes.length === 0}
              data-testid="button-start-search"
            >
              {searchMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Start Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientCard({ 
  client, 
  isExpanded, 
  onToggle, 
  onDelete, 
  onSearch,
  isSearching 
}: { 
  client: ClientBusiness;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSearch: () => void;
  isSearching: boolean;
}) {
  const { toast } = useToast();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    scheduleType: "weekly" as "interval" | "weekly" | "monthly",
    intervalDays: 7,
    dayOfWeek: 1,
    dayOfMonth: 1,
    runHour: 9,
  });
  
  const { data: searches = [], isLoading: searchesLoading } = useQuery<LeadSearch[]>({
    queryKey: ["/api/leads/clients", client.id, "searches"],
    queryFn: async () => {
      const response = await fetch(`/api/leads/clients/${client.id}/searches`);
      if (!response.ok) throw new Error("Failed to fetch searches");
      return response.json();
    },
    enabled: isExpanded,
  });
  
  const { data: schedules = [] } = useQuery<LeadSearchSchedule[]>({
    queryKey: ["/api/leads/clients", client.id, "schedules"],
    queryFn: async () => {
      const response = await fetch(`/api/leads/clients/${client.id}/schedules`);
      if (!response.ok) throw new Error("Failed to fetch schedules");
      return response.json();
    },
    enabled: isExpanded,
  });
  
  const { data: swotAnalyses = [] } = useQuery<LeadsSwotAnalysis[]>({
    queryKey: ["/api/leads/clients", client.id, "swot"],
    queryFn: async () => {
      const response = await fetch(`/api/leads/clients/${client.id}/swot`);
      if (!response.ok) throw new Error("Failed to fetch SWOT analyses");
      return response.json();
    },
    enabled: isExpanded,
    refetchInterval: (query) => {
      const latestSwot = query.state.data?.[0];
      if (latestSwot?.status === "generating" || latestSwot?.status === "pending") {
        return 3000;
      }
      return false;
    },
  });
  
  const generateSwotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/leads/clients/${client.id}/swot`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/clients", client.id, "swot"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/leads/clients", client.id, "swot"] });
      }, 1500);
      toast({ title: "SWOT analysis started", description: "Analyzing competitor data..." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate SWOT", description: error.message, variant: "destructive" });
    },
  });
  
  const createScheduleMutation = useMutation({
    mutationFn: async (data: typeof scheduleForm) => {
      return apiRequest("POST", `/api/leads/clients/${client.id}/schedules`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/clients", client.id, "schedules"] });
      setScheduleDialogOpen(false);
      toast({ title: "Schedule created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create schedule", description: error.message, variant: "destructive" });
    },
  });
  
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      return apiRequest("DELETE", `/api/leads/schedules/${scheduleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/clients", client.id, "schedules"] });
      toast({ title: "Schedule deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete schedule", description: error.message, variant: "destructive" });
    },
  });
  
  const activeSchedule = schedules.find(s => s.isActive);

  const latestSearch = searches[0];
  const results = (latestSearch?.results || []) as LeadBusiness[];
  
  const formatSchedule = (schedule: LeadSearchSchedule) => {
    const hour = schedule.runHour ?? 9;
    const hourStr = hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;
    
    if (schedule.scheduleType === "interval") {
      return `Every ${schedule.intervalDays} days at ${hourStr}`;
    } else if (schedule.scheduleType === "weekly") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Every ${days[schedule.dayOfWeek ?? 1]} at ${hourStr}`;
    } else {
      return `Monthly on day ${schedule.dayOfMonth} at ${hourStr}`;
    }
  };

  return (
    <Card data-testid={`card-client-${client.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              {client.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge 
                variant={
                  client.businessType === "ideal_customer" ? "default" : 
                  client.businessType === "competitor" ? "secondary" : "outline"
                }
                className="flex items-center gap-1"
              >
                {client.businessType === "ideal_customer" && <Target className="w-3 h-3" />}
                {client.businessType === "competitor" && <Users className="w-3 h-3" />}
                {client.businessType === "partnering_prospect" && <Handshake className="w-3 h-3" />}
                {client.businessType === "ideal_customer" ? "Ideal Customer" : 
                 client.businessType === "competitor" ? "Competitor" : "Partnering Prospect"}
              </Badge>
              <Badge variant="secondary">{client.keyword}</Badge>
              <span className="flex items-center gap-1 text-xs">
                <MapPin className="w-3 h-3" />
                {client.zipCode || client.city || client.address}
              </span>
              {activeSchedule && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatSchedule(activeSchedule)}
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              size="sm" 
              onClick={onSearch}
              disabled={isSearching}
              data-testid={`button-search-${client.id}`}
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-1" />
              )}
              Find Leads
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setScheduleDialogOpen(true)}
              data-testid={`button-schedule-${client.id}`}
            >
              <Calendar className="w-4 h-4" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onDelete}
              data-testid={`button-delete-${client.id}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onToggle}
              data-testid={`button-toggle-${client.id}`}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Automatic Lead Searches</DialogTitle>
          </DialogHeader>
          
          {activeSchedule ? (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{formatSchedule(activeSchedule)}</p>
                    {activeSchedule.nextRunAt && (
                      <p className="text-sm text-muted-foreground">
                        Next run: {new Date(activeSchedule.nextRunAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteScheduleMutation.mutate(activeSchedule.id)}
                    disabled={deleteScheduleMutation.isPending}
                    data-testid="button-delete-schedule"
                  >
                    {deleteScheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select 
                  value={scheduleForm.scheduleType} 
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, scheduleType: v as any })}
                >
                  <SelectTrigger data-testid="select-schedule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interval">Every X Days</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {scheduleForm.scheduleType === "interval" && (
                <div className="space-y-2">
                  <Label>Run every (days)</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={365}
                    value={scheduleForm.intervalDays}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, intervalDays: Number(e.target.value) })}
                    data-testid="input-interval-days"
                  />
                </div>
              )}
              
              {scheduleForm.scheduleType === "weekly" && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select 
                    value={String(scheduleForm.dayOfWeek)} 
                    onValueChange={(v) => setScheduleForm({ ...scheduleForm, dayOfWeek: Number(v) })}
                  >
                    <SelectTrigger data-testid="select-day-of-week">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {scheduleForm.scheduleType === "monthly" && (
                <div className="space-y-2">
                  <Label>Day of Month (1-28)</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={28}
                    value={scheduleForm.dayOfMonth}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfMonth: Number(e.target.value) })}
                    data-testid="input-day-of-month"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Run at Hour (0-23)</Label>
                <Select 
                  value={String(scheduleForm.runHour)} 
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, runHour: Number(v) })}
                >
                  <SelectTrigger data-testid="select-run-hour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createScheduleMutation.mutate(scheduleForm)}
                  disabled={createScheduleMutation.isPending}
                  data-testid="button-create-schedule"
                >
                  {createScheduleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Schedule
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {isExpanded && (
        <CardContent className="pt-4 border-t">
          {client.notes && (
            <p className="text-sm text-muted-foreground mb-4">{client.notes}</p>
          )}
          
          <Tabs defaultValue="leads" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="leads" data-testid="tab-leads">
                <Search className="w-4 h-4 mr-2" />
                Leads ({results.length})
              </TabsTrigger>
              <TabsTrigger value="swot" data-testid="tab-swot">
                <Lightbulb className="w-4 h-4 mr-2" />
                SWOT Analysis
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="leads">
              {searchesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : searches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No searches yet. Click "Find Leads" to search for nearby businesses.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      Last search: {latestSearch?.createdAt ? new Date(latestSearch.createdAt).toLocaleString() : "Unknown"}
                      {latestSearch?.status === "pending" && (
                        <Badge variant="outline" className="ml-2">Pending - Webhook not configured</Badge>
                      )}
                      {latestSearch?.status === "running" && (
                        <Badge variant="outline" className="ml-2">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          Running
                        </Badge>
                      )}
                      {latestSearch?.status === "error" && (
                        <Badge variant="destructive" className="ml-2">Error</Badge>
                      )}
                    </div>
                    {results.length > 0 && (
                      <Badge>{results.length} leads found</Badge>
                    )}
                  </div>
                  
                  {results.length > 0 ? (
                    <div className="grid gap-3">
                      {results.map((lead, idx) => (
                        <LeadCard key={lead.placeId || idx} lead={lead} />
                      ))}
                    </div>
                  ) : latestSearch?.status === "completed" ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No leads found in this search.
                    </p>
                  ) : null}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="swot">
              <SwotAnalysis 
                analysis={swotAnalyses[0] || null}
                isGenerating={generateSwotMutation.isPending}
                onGenerate={() => generateSwotMutation.mutate()}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

function LeadCard({ lead }: { lead: LeadBusiness }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-2" data-testid={`lead-${lead.placeId || lead.title}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium truncate">{lead.title}</h4>
          {lead.ownerName && (
            <p className="text-sm text-muted-foreground">Owner: {lead.ownerName}</p>
          )}
          {lead.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{lead.address}</span>
            </p>
          )}
        </div>
        {lead.rating && (
          <div className="flex items-center gap-1 text-sm flex-shrink-0">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span>{lead.rating}</span>
            {lead.reviews && <span className="text-muted-foreground">({lead.reviews})</span>}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3 flex-wrap text-sm">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <Phone className="w-3 h-3" />
            {lead.phone}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <Mail className="w-3 h-3" />
            {lead.email}
            {lead.confidence && (
              <Badge variant="outline" className="text-xs ml-1">
                {lead.confidence}
              </Badge>
            )}
          </a>
        )}
        {lead.website && (
          <a 
            href={lead.website} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Globe className="w-3 h-3" />
            {lead.domain || "Website"}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
