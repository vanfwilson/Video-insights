import { db } from "../db";
import { intelAnalyses, intelBusinesses, type InsertIntelAnalysis, type InsertIntelBusiness } from "@shared/schema";
import { eq } from "drizzle-orm";

const N8N_WEBHOOK = 'https://automation.aiautomationauthority.com/webhook/business-intelligence';

function getCallbackUrl(): string {
  const replitUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'https://app.askstephen.ai';
  return `${replitUrl}/api/intel/callback`;
}

export interface BusinessIntelRequest {
  clientBusinessId: number;
  businessType: string;
  businessName: string;
  geo: string;
  placeId?: string;
  competitors?: Array<{ placeId: string; name: string }>;
  actions: Array<'reviews' | 'competitors' | 'partnerships'>;
}

export async function requestBusinessIntelligence(request: BusinessIntelRequest) {
  const requestBody = {
    ...request,
    callbackUrl: getCallbackUrl()
  };

  console.log('[BI] Sending request to n8n:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    console.log('[BI] n8n response:', data);

    return {
      status: 'processing',
      message: 'Analysis started. Results will arrive at callback webhook.',
      jobId: data.jobId || Date.now()
    };

  } catch (error) {
    console.error('[BI] n8n request failed:', error);
    throw error;
  }
}

export interface IntelCallbackResults {
  clientBusinessId: number;
  actionsCompleted: string[];
  timestamp: string;
  reviewsAnalysis?: {
    sentimentSummary?: { positive: number; neutral: number; negative: number };
    suggestedCoreValue?: string;
    strengths?: string[];
    weaknesses?: string[];
  };
  competitorAnalysis?: any;
  partnershipAnalysis?: {
    topPartners?: Array<{
      placeId: string;
      name: string;
      industry: string;
      category: string;
      rating: number;
      reviewCount: number;
      address: string;
      phone: string;
      website: string;
      partnershipScore: number;
      referralTrigger: string;
      approachScript?: string;
      personalizedApproach?: string;
      potentialValue: string;
    }>;
  };
}

export async function storeIntelResults(results: IntelCallbackResults) {
  const { clientBusinessId, actionsCompleted } = results;
  console.log('[BI] Storing results for client:', clientBusinessId, 'Actions:', actionsCompleted);

  if (results.reviewsAnalysis) {
    await db.insert(intelAnalyses).values({
      clientBusinessId,
      analysisType: 'reviews',
      results: results.reviewsAnalysis as any,
    });
    console.log('[BI] Stored reviews analysis');
  }

  if (results.competitorAnalysis) {
    await db.insert(intelAnalyses).values({
      clientBusinessId,
      analysisType: 'competitors',
      results: results.competitorAnalysis as any,
    });
    console.log('[BI] Stored competitor analysis');
  }

  if (results.partnershipAnalysis?.topPartners) {
    for (const partner of results.partnershipAnalysis.topPartners) {
      try {
        await db.insert(intelBusinesses).values({
          clientBusinessId,
          placeId: partner.placeId,
          name: partner.name,
          businessType: 'partner',
          industry: partner.industry,
          category: partner.category,
          rating: partner.rating?.toString(),
          reviewCount: partner.reviewCount,
          address: partner.address,
          phone: partner.phone,
          website: partner.website,
          partnershipScore: partner.partnershipScore,
          referralTrigger: partner.referralTrigger,
          approachScript: partner.approachScript || partner.personalizedApproach,
          potentialValue: partner.potentialValue,
          rawData: partner as any,
        }).onConflictDoUpdate({
          target: intelBusinesses.placeId,
          set: {
            partnershipScore: partner.partnershipScore,
            updatedAt: new Date(),
          }
        });
      } catch (err) {
        console.error('[BI] Error storing partner:', partner.name, err);
      }
    }
    console.log('[BI] Stored', results.partnershipAnalysis.topPartners.length, 'partners');
  }
}

export async function getIntelResults(clientBusinessId: number, type?: string) {
  const results: any = {};

  if (!type || type === 'all' || type === 'reviews') {
    const reviews = await db.select()
      .from(intelAnalyses)
      .where(eq(intelAnalyses.clientBusinessId, clientBusinessId))
      .orderBy(intelAnalyses.createdAt);
    
    const reviewsResult = reviews.filter(r => r.analysisType === 'reviews').pop();
    if (reviewsResult) results.reviews = reviewsResult.results;
  }

  if (!type || type === 'all' || type === 'competitors') {
    const competitors = await db.select()
      .from(intelAnalyses)
      .where(eq(intelAnalyses.clientBusinessId, clientBusinessId))
      .orderBy(intelAnalyses.createdAt);
    
    const competitorsResult = competitors.filter(r => r.analysisType === 'competitors').pop();
    if (competitorsResult) results.competitors = competitorsResult.results;
  }

  if (!type || type === 'all' || type === 'partnerships') {
    const partners = await db.select()
      .from(intelBusinesses)
      .where(eq(intelBusinesses.clientBusinessId, clientBusinessId))
      .orderBy(intelBusinesses.partnershipScore);
    
    results.partners = partners;
  }

  return results;
}
