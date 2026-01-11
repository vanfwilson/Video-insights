import { storage } from "../storage";
import axios from "axios";
import type { SearchType, LeadBusiness } from "@shared/schema";

export async function executeLeadSearch(
  clientId: number, 
  userId: string, 
  searchTypes: SearchType[] = ["ideal_customer", "competitor", "partner"],
  verifyEmails: boolean = false,
  triggeredBy: 'manual' | 'schedule' = 'manual'
): Promise<{ searchId: number; status: string }> {
  const client = await storage.getClientBusiness(clientId);
  if (!client) {
    throw new Error("Client business not found");
  }
  
  const geo = client.zipCode || client.city || client.address;
  if (!geo) {
    throw new Error("Client business needs a location (ZIP, city, or address) to search");
  }
  
  const search = await storage.createLeadSearch({
    clientBusinessId: clientId,
    userId,
    keyword: client.keyword,
    geo,
    startOffset: 0,
    searchTypes,
    verifyEmailsRequested: verifyEmails,
    status: "pending",
  });
  
  const webhookUrl = process.env.LEADS_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log(`[LeadsScheduler] Webhook not configured, search ${search.id} left pending`);
    return { searchId: search.id, status: "pending" };
  }
  
  await storage.updateLeadSearch(search.id, { status: "running" });
  
  (async () => {
    try {
      console.log(`[LeadsScheduler] Executing search ${search.id} for client ${clientId} (${triggeredBy})`);
      
      const callbackUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/leads/webhook/results`
        : process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/leads/webhook/results`
          : 'https://app.askstephen.ai/api/leads/webhook/results';
      
      const webhookPayload = {
        domain: "askstephen.ai",
        webapp: "Video-Publisher-AI",
        client: userId,
        client_business_id: clientId,
        search_id: `search-${search.id}`,
        keyword: client.keyword,
        geo,
        search_types: searchTypes,
        verify_emails: verifyEmails,
        callback_url: callbackUrl,
      };
      
      console.log(`[LeadsScheduler] Calling webhook:`, JSON.stringify(webhookPayload));
      
      const response = await axios.post(webhookUrl, webhookPayload, { timeout: 120000 });
      
      console.log(`[LeadsScheduler] Webhook response status:`, response.status);
      
      let results: LeadBusiness[] = [];
      
      if (Array.isArray(response.data)) {
        results = mapN8nResults(response.data);
      } else if (response.data?.results && Array.isArray(response.data.results)) {
        results = mapN8nResults(response.data.results);
      } else if (response.data?.success) {
        console.log(`[LeadsScheduler] Webhook returned success, search_id: ${response.data.search_id}`);
        results = [];
      }
      
      await storage.updateLeadSearch(search.id, {
        status: "completed",
        results,
        totalFound: results.length,
      } as any);
      
      console.log(`[LeadsScheduler] Search ${search.id} completed with ${results.length} results`);
    } catch (error: any) {
      console.error(`[LeadsScheduler] Search ${search.id} failed:`, error.message);
      await storage.updateLeadSearch(search.id, {
        status: "error",
        errorMessage: error.message || "Webhook call failed",
      } as any);
    }
  })();
  
  return { searchId: search.id, status: "running" };
}

export function mapN8nResults(data: any[]): LeadBusiness[] {
  return data.map((r: any) => ({
    position: r.position,
    title: r.title || r.name,
    placeId: r.place_id || r.placeId,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    phone: r.phone,
    website: r.website,
    email: r.email,
    emailStatus: r.email_status || r.emailStatus || "unknown",
    rating: r.rating,
    reviews: r.reviews || r.review_count,
    businessType: mapBusinessType(r.business_type || r.businessType),
    industry: r.industry,
    category: r.category,
    ownerName: r.owner_name || r.ownerName,
    confidence: r.confidence,
    domain: r.domain,
    gpsCoordinates: r.gps_coordinates || r.gpsCoordinates,
    partnershipScore: r.partnership_score || r.partnershipScore,
    partnershipFactors: r.partnership_factors || r.partnershipFactors,
    referralTrigger: r.referral_trigger || r.referralTrigger,
    partnershipModel: r.partnership_model || r.partnershipModel,
    approachScript: r.approach_script || r.approachScript,
    potentialValue: r.potential_value || r.potentialValue,
  }));
}

function mapBusinessType(type: string | undefined): "ideal_customer" | "competitor" | "partner" | "lead" | undefined {
  if (!type) return undefined;
  const normalized = type.toLowerCase().replace(/[_\s-]/g, '');
  if (normalized === 'idealcustomer' || normalized === 'lead' || normalized === 'user') return 'ideal_customer';
  if (normalized === 'competitor') return 'competitor';
  if (normalized === 'partner' || normalized === 'partneringprospect') return 'partner';
  return 'lead';
}
