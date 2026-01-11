-- =====================================================
-- Pick One Business Intelligence - PostgreSQL Schema
-- For n8n Docker Stack PostgreSQL instance
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CACHING LAYER
-- Short-term cache for SerpAPI responses
-- =====================================================

CREATE TABLE IF NOT EXISTS business_cache (
  place_id VARCHAR(100) PRIMARY KEY,
  business_data JSONB,
  reviews JSONB,
  fetched_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_cache_expires ON business_cache(expires_at);

-- Clean up expired cache entries (run daily via cron)
-- DELETE FROM business_cache WHERE expires_at < NOW();

-- =====================================================
-- UNIFIED BUSINESSES TABLE
-- All scraped businesses in one place with type tags
-- =====================================================

CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  client_business_id INTEGER,           -- Links to Replit's client record
  place_id VARCHAR(100) UNIQUE,
  
  -- Basic info
  name VARCHAR(255),
  business_type VARCHAR(50),            -- 'user', 'competitor', 'partner', 'lead'
  industry VARCHAR(100),                -- For partners: 'General Contractor', 'HVAC', etc.
  category VARCHAR(50),                 -- For partners: 'PRIMARY', 'SECONDARY', 'EVENT_BASED'
  
  -- Google Maps data
  rating DECIMAL(2,1),
  review_count INTEGER,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  phone VARCHAR(50),
  website VARCHAR(255),
  hours JSONB,
  
  -- Contact data
  email VARCHAR(255),
  email_status VARCHAR(20) DEFAULT 'unknown',  -- unknown, unverified, valid, invalid, catch_all, disposable
  email_verified_at TIMESTAMP,
  email_verification_result JSONB,
  
  -- Partnership scoring (for partners)
  partnership_score INTEGER,
  partnership_factors JSONB,            -- { referralPotential, reputationMatch, establishedPresence }
  referral_trigger TEXT,
  partnership_model TEXT,
  approach_script TEXT,
  potential_value VARCHAR(20),          -- Low, Medium, High, Very High
  
  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_businesses_client ON businesses(client_business_id);
CREATE INDEX idx_businesses_type ON businesses(business_type);
CREATE INDEX idx_businesses_industry ON businesses(industry);
CREATE INDEX idx_businesses_place_id ON businesses(place_id);

-- =====================================================
-- REVIEWS TABLE
-- Stored separately due to volume
-- =====================================================

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(100) REFERENCES businesses(place_id) ON DELETE CASCADE,
  source VARCHAR(20),                   -- 'google', 'yelp'
  
  -- Review content
  rating INTEGER,
  text TEXT,
  author VARCHAR(255),
  review_date DATE,
  helpful_count INTEGER DEFAULT 0,
  
  -- AI analysis (filled later)
  sentiment VARCHAR(20),                -- positive, neutral, negative
  sentiment_score DECIMAL(3,2),         -- 0.00 to 1.00
  themes JSONB,                         -- ['quality', 'communication', 'price']
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_place ON reviews(place_id);
CREATE INDEX idx_reviews_sentiment ON reviews(sentiment);

-- =====================================================
-- ANALYSES TABLE
-- Stores AI analysis results
-- =====================================================

CREATE TABLE IF NOT EXISTS analyses (
  id SERIAL PRIMARY KEY,
  client_business_id INTEGER,
  analysis_type VARCHAR(50),            -- 'reviews', 'competitors', 'partnerships', 'full'
  
  -- Results
  results JSONB,
  
  -- What data was used
  place_ids_analyzed TEXT[],            -- Array of place_ids included
  
  -- Metadata
  model_used VARCHAR(100),              -- 'mistral-small-3', 'deepseek-chat', etc.
  tokens_used INTEGER,
  cost_estimate DECIMAL(8,6),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analyses_client ON analyses(client_business_id);
CREATE INDEX idx_analyses_type ON analyses(analysis_type);

-- =====================================================
-- EMAIL VERIFICATION LOG
-- Track verification attempts and results
-- =====================================================

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  place_id VARCHAR(100),
  
  -- Verification result
  status VARCHAR(20),                   -- valid, invalid, catch_all, disposable, unknown
  provider VARCHAR(50),                 -- 'emailable', 'zerobounce', 'neverbounce'
  result JSONB,                         -- Full API response
  
  -- Metadata
  verified_at TIMESTAMP DEFAULT NOW(),
  cost DECIMAL(8,6)
);

CREATE INDEX idx_email_verifications_email ON email_verifications(email);
CREATE INDEX idx_email_verifications_status ON email_verifications(status);

-- =====================================================
-- API USAGE TRACKING
-- Monitor costs across all APIs
-- =====================================================

CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  client_business_id INTEGER,
  api_name VARCHAR(50),                 -- 'serpapi', 'openrouter', 'emailable'
  endpoint VARCHAR(100),
  
  -- Cost tracking
  credits_used INTEGER DEFAULT 1,
  cost_estimate DECIMAL(8,6),
  
  -- Request details
  request_params JSONB,
  response_status INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_usage_client ON api_usage(client_business_id);
CREATE INDEX idx_api_usage_api ON api_usage(api_name);
CREATE INDEX idx_api_usage_date ON api_usage(created_at);

-- View for daily costs
CREATE OR REPLACE VIEW daily_api_costs AS
SELECT 
  DATE(created_at) as date,
  api_name,
  COUNT(*) as requests,
  SUM(credits_used) as total_credits,
  SUM(cost_estimate) as total_cost
FROM api_usage
GROUP BY DATE(created_at), api_name
ORDER BY date DESC, api_name;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check cache before API call
CREATE OR REPLACE FUNCTION check_cache(p_place_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  cached_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'business', business_data,
    'reviews', reviews,
    'cached_at', fetched_at
  ) INTO cached_data
  FROM business_cache
  WHERE place_id = p_place_id
    AND expires_at > NOW();
  
  RETURN cached_data;
END;
$$ LANGUAGE plpgsql;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
  p_client_id INTEGER,
  p_api VARCHAR,
  p_endpoint VARCHAR,
  p_credits INTEGER DEFAULT 1,
  p_cost DECIMAL DEFAULT 0.01
)
RETURNS void AS $$
BEGIN
  INSERT INTO api_usage (client_business_id, api_name, endpoint, credits_used, cost_estimate)
  VALUES (p_client_id, p_api, p_endpoint, p_credits, p_cost);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE QUERIES FOR REPORTING
-- =====================================================

-- Get all partners for a client, sorted by score
-- SELECT * FROM businesses 
-- WHERE client_business_id = 123 
--   AND business_type = 'partner'
-- ORDER BY partnership_score DESC;

-- Get recent API costs by client
-- SELECT client_business_id, SUM(cost_estimate) as total_cost
-- FROM api_usage
-- WHERE created_at > NOW() - INTERVAL '30 days'
-- GROUP BY client_business_id
-- ORDER BY total_cost DESC;

-- Get cache hit rate
-- SELECT 
--   COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_cache,
--   COUNT(*) as total_cache,
--   ROUND(100.0 * COUNT(*) FILTER (WHERE expires_at > NOW()) / NULLIF(COUNT(*), 0), 2) as hit_rate_pct
-- FROM business_cache;
