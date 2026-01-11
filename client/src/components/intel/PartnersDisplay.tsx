import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Globe, Star, Users, MapPin, TrendingUp } from "lucide-react";

interface Partner {
  id: number;
  name: string;
  industry: string;
  category: string;
  rating: string;
  reviewCount: number;
  address: string;
  phone: string;
  website: string;
  partnershipScore: number;
  referralTrigger: string;
  approachScript: string;
  potentialValue: string;
}

interface PartnersDisplayProps {
  clientBusinessId: number;
}

export function PartnersDisplay({ clientBusinessId }: PartnersDisplayProps) {
  const { data, isLoading, error } = useQuery<{ partners: Partner[] }>({
    queryKey: ['/api/intel/results', clientBusinessId, 'partnerships'],
    queryFn: async () => {
      const res = await fetch(`/api/intel/results/${clientBusinessId}?type=partnerships`);
      if (!res.ok) throw new Error('Failed to fetch partners');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="partners-loading">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4" data-testid="partners-error">
        Failed to load partners
      </div>
    );
  }

  const partners = data?.partners || [];

  if (!partners.length) {
    return (
      <div className="text-muted-foreground p-4 text-center" data-testid="partners-empty">
        No partners found yet. Run Partnership Finder first.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="partners-list">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Users className="h-5 w-5" />
        Top Partnership Opportunities
      </h2>

      {partners.map((partner) => (
        <Card key={partner.id} className="hover-elevate" data-testid={`partner-card-${partner.id}`}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-4">
              <div>
                <CardTitle className="text-lg">{partner.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {partner.industry} 
                  {partner.category && <Badge variant="outline" className="ml-2">{partner.category}</Badge>}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{partner.partnershipScore}</div>
                <div className="text-xs text-muted-foreground">Partner Score</div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {partner.address && (
              <p className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {partner.address}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm">
              {partner.rating && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  {partner.rating}
                </span>
              )}
              {partner.reviewCount > 0 && (
                <span className="text-muted-foreground">
                  {partner.reviewCount} reviews
                </span>
              )}
              {partner.potentialValue && (
                <Badge 
                  variant={partner.potentialValue === 'Very High' ? 'default' : 
                          partner.potentialValue === 'High' ? 'secondary' : 'outline'}
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {partner.potentialValue} Value
                </Badge>
              )}
            </div>

            {partner.referralTrigger && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <strong>Why partner:</strong> {partner.referralTrigger}
              </div>
            )}

            {partner.approachScript && (
              <div className="p-3 bg-primary/5 rounded-md text-sm">
                <strong>Approach:</strong> {partner.approachScript}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {partner.phone && (
                <Button size="sm" variant="outline" asChild data-testid={`partner-call-${partner.id}`}>
                  <a href={`tel:${partner.phone}`}>
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </a>
                </Button>
              )}
              {partner.website && (
                <Button size="sm" variant="outline" asChild data-testid={`partner-website-${partner.id}`}>
                  <a href={partner.website} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4 mr-1" />
                    Website
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
