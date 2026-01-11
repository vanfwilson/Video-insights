# Video Studio AI

## Overview

Video Studio AI is a full-stack web application with two major features:

1. **Video Publisher** (for admin/creative/superadmin roles): Automates video workflow management - upload videos, automatically transcribe them using AssemblyAI, generate AI-powered metadata (titles, descriptions, tags, thumbnails), and publish directly to YouTube.

2. **Pick One Workbook** (for pickone role): A 5-section business strategy workbook with AI coaching. Users work through Core Value discovery, SWOT Analysis, Root Cause Chart (5 Whys), Time Audit, and 90-Day Action Plan sections sequentially.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Build Tool**: Vite with hot module replacement

The frontend follows a pages-based structure with custom hooks for data fetching (`use-videos.ts`, `use-auth.ts`). Components are organized with a shared UI component library in `client/src/components/ui/`.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Clerk Auth with @clerk/express middleware
- **File Uploads**: Multer with 500MB limit, stored in `uploads/` directory

The server follows a modular integration pattern with features organized under `server/replit_integrations/`:
- `clerkAuth.ts` - Authentication handling with Clerk (setupClerkAuth, isAuthenticated, getUserId, getUserFromDb)
- `chat/` - AI chat functionality using OpenAI
- `image/` - Image generation using OpenAI's gpt-image-1 model
- `batch/` - Batch processing utilities with rate limiting

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` with related models in `shared/models/`
- **Key Tables**:
  - `users` - User accounts from Replit Auth (role field: superadmin, admin, creative, search, pickone)
  - `sessions` - Session storage for authentication
  - `videos` - Video metadata, transcripts, and publishing status
  - `conversations`/`messages` - AI chat history
  - `workbook_progress` - Tracks workbook completion status per user
  - `core_values` - Core Value discovery answers
  - `swot_analyses` - SWOT analyses by business area
  - `root_cause_charts` - 5 Whys root cause analysis
  - `time_audits` - Time management audit data
  - `action_plans` - 90-Day action plan with milestones

### API Structure
Routes are defined in `shared/routes.ts` with Zod validation schemas. Key video endpoints:
- `POST /api/upload` - Video file upload
- `GET /api/videos` - List user's videos
- `GET /api/videos/:id` - Get video details
- `PATCH /api/videos/:id` - Update video metadata
- `POST /api/videos/:id/generate-metadata` - AI metadata generation
- `POST /api/videos/:id/generate-thumbnail` - AI thumbnail generation
- `POST /api/videos/:id/publish` - Publish to YouTube

Workbook API endpoints (pickone role only - protected by requirePickoneRole middleware):
- `GET/POST /api/workbook/progress` - Workbook completion tracking
- `GET/POST /api/workbook/core-value` - Core Value discovery data
- `GET/POST /api/workbook/swot` - SWOT analysis (per business area)
- `GET /api/workbook/swot/all` - All SWOT analyses for user
- `GET/POST /api/workbook/root-cause` - Root cause chart data
- `GET/POST /api/workbook/time-audit` - Time audit data
- `GET/POST /api/workbook/action-plan` - 90-Day action plan
- `POST /api/workbook/ai-coach` - AI coaching responses

### Local Business Research Feature
Uses n8n webhook integration to find ideal customers, competitors, and partnering prospects.

Lead Search API endpoints:
- `GET /api/leads/clients` - List client businesses
- `POST /api/leads/clients` - Create new client business
- `DELETE /api/leads/clients/:id` - Delete client business
- `GET /api/leads/clients/:id/searches` - List lead searches for client
- `POST /api/leads/clients/:id/search` - Trigger new lead search with options
- `GET/POST /api/leads/clients/:id/swot` - SWOT analysis for leads

Search options payload:
- `searchTypes`: Array of ["ideal_customer", "competitor", "partner"]
- `verifyEmails`: Boolean for email verification (extra cost)

Webhook URL: `LEADS_WEBHOOK_URL` environment variable

Callback endpoint for n8n to return results:
- `POST /api/leads/webhook/results` - Public endpoint (no auth required)
- Payload: `{ search_id: "search-123", results: [...], error?: "message" }`
- The `callback_url` is automatically included in the webhook payload sent to n8n

Database columns for lead_searches:
- `search_types` - text array, defaults to all three types
- `verify_emails_requested` - boolean, defaults to false

Migration (if needed): Run these SQL commands if columns don't exist:
```sql
ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS search_types text[] DEFAULT ARRAY['ideal_customer', 'competitor', 'partner'];
ALTER TABLE lead_searches ADD COLUMN IF NOT EXISTS verify_emails_requested boolean DEFAULT false;
```

### Business Intelligence Integration (n8n)
Uses n8n webhook at `https://automation.aiautomationauthority.com/webhook/business-intelligence` for AI-powered business analysis.

API Endpoints:
- `POST /api/intel/callback` - Public webhook for n8n to send results
- `POST /api/intel/analyze` - Trigger analysis (requires auth)
- `GET /api/intel/results/:clientBusinessId` - Get stored results

Request payload for /api/intel/analyze:
```json
{
  "clientBusinessId": 123,
  "businessType": "Residential Electrician",
  "businessName": "ABC Electric",
  "geo": "Austin, TX",
  "placeId": "ChIJxxxx",
  "actions": ["reviews", "competitors", "partnerships"]
}
```

Database tables:
- `intel_analyses` - Stores AI analysis results (reviews, competitors)
- `intel_businesses` - Stores partner/lead business records with partnership scores

Frontend components (in `client/src/components/intel/`):
- `PartnersDisplay` - Shows partnership opportunities with scores and approach scripts
- `ReviewsDisplay` - Shows sentiment analysis, strengths, weaknesses
- `AnalyzeTrigger` - Buttons to trigger different analysis types

### Video Processing Pipeline
1. **Upload**: Video stored locally, database record created with "uploading" status
2. **Transcription**: AssemblyAI processes the video, status becomes "transcribing"
3. **Metadata Generation**: AI generates title, description, tags from transcript
4. **Thumbnail Generation**: OpenAI generates thumbnail from prompt
5. **Publishing**: Video published to YouTube with configured privacy settings

## External Dependencies

### Third-Party Services
- **AssemblyAI**: Video/audio transcription service (requires `ASSEMBLYAI_API_KEY`)
- **OpenAI**: AI chat, metadata generation, and image generation via Replit AI Integrations
- **YouTube API**: Video publishing (OAuth credentials required)
- **Clerk**: User authentication (requires `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `ASSEMBLYAI_API_KEY` - For transcription
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API access
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI endpoint (Replit proxy)
- `CLERK_PUBLISHABLE_KEY` - Clerk production publishable key (pk_live_*)
- `CLERK_SECRET_KEY` - Clerk production secret key (sk_live_*)

### Cloud Storage Integration (Dropbox)
- Connected via Replit connector: `connection:conn_dropbox_01KE9PFV0VB4NCY65BHVMTKAXE`
- Users can browse and select folders from their connected Dropbox account
- Connection info stored in `cloud_connections` table per user
- Recursive video file search across entire folder hierarchies
- Checkbox-based video selection with select-all functionality
- Video import queue processes one video at a time
- Progress tracking via `video_ingest_requests` table with status updates
- Dropbox API routes: `/api/dropbox/status`, `/api/dropbox/files`, `/api/dropbox/connect`, `/api/dropbox/select-folder`, `/api/dropbox/search-videos`
- Ingest API routes: `/api/ingest-requests` (GET list, POST create, DELETE cancel)
- Client module: `server/cloud-providers/dropbox.ts`
- Background worker: `server/ingest-worker.ts` - processes queued imports

### Key NPM Dependencies
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `@tanstack/react-query` - Server state management
- `openai` - AI API client
- `assemblyai` - Transcription API client
- `multer` - File upload handling
- `@clerk/clerk-react` / `@clerk/express` - Authentication
- `framer-motion` - UI animations
- `date-fns` - Date formatting