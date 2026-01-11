# Video Studio AI - Design Guidelines

## Design Approach
**System:** Linear-inspired dark UI + Material Design form patterns
**Rationale:** Professional productivity tool requiring consistent, sophisticated dark interface with robust form components and clear information hierarchy.

## Core Design Elements

### Typography
- **Primary Font:** Inter (Google Fonts)
- **Display:** 600 weight, tracking-tight for headlines
- **Body:** 400/500 weights for content
- **Scale:** text-sm (14px) base, text-lg (18px) section headers, text-3xl+ for page titles
- **Hierarchy:** Stark contrast between section titles and body text through size and weight

### Layout System
**Spacing Primitives:** Tailwind units of 3, 4, 6, 8, 12, 16
- Container max-width: max-w-7xl
- Section padding: px-4 md:px-6 lg:px-8, py-12 md:py-16
- Card spacing: p-6 md:p-8
- Element gaps: gap-4 (cards), gap-6 (sections), gap-2 (inline elements)

### Component Library

**Navigation:**
- Fixed dark header (bg-gray-950) with slight border-b border-gray-800
- Left-aligned logo, center nav items, right-aligned user avatar/CTA
- Mobile: Slide-out drawer with overlay

**Hero Section:**
- Full-width hero (h-[500px] md:h-[600px])
- Image: Professional video editing workspace/AI interface mockup (dark, moody lighting)
- Centered content overlay with blurred-background buttons
- Headline + supporting text + dual CTA (primary "Start Free Trial", secondary "Watch Demo")

**Workbook Dashboard Cards:**
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Each card: Dark background (bg-gray-900), rounded-xl, subtle border (border-gray-800)
- Left accent stripe (4px width) in section color: Core Value (blue-500), SWOT (emerald-500), Root Cause (purple-500), Time Audit (amber-500), 90-Day Plan (slate-400)
- Card contents: Icon + title + description + progress bar + "Continue" button
- Hover: Subtle lift (transform scale-[1.02]) and border glow in accent color

**Progress Tracking:**
- Horizontal progress bar below card title
- bg-gray-800 base, accent color fill
- Percentage text (text-sm, text-gray-400) aligned right
- Step indicators (e.g., "3 of 7 complete") below progress bar

**Wizard Interface:**
- Full-page modal or dedicated page with sidebar navigation
- Left sidebar: Vertical step list with numbers, current step highlighted in accent color
- Main area: Single-focus form with large input fields, clear labels
- Bottom navigation: Back/Next buttons, auto-save indicator
- AI coaching widget: Floating bottom-right, expandable chat panel (bg-gray-900, border glow)

**Form Components:**
- Large input fields (p-4, text-base)
- Labels above inputs (text-sm, text-gray-400)
- Dark inputs (bg-gray-800, border-gray-700, focus:border-accent)
- Textareas: min-h-[120px]
- Radio/checkboxes: Custom styled in section accent colors
- Validation: Inline error messages in red-400

**AI Coaching Panel:**
- Slide-in from right or bottom
- Chat-style interface with user/AI message bubbles
- AI messages: bg-gray-800, user messages: accent color background
- Input bar at bottom with send button
- "Ask AI Coach" trigger button in wizards

**Footer:**
- Dark (bg-gray-950) with 3-column layout on desktop
- Column 1: Logo + tagline
- Column 2: Quick links (Features, Pricing, Support)
- Column 3: Newsletter signup + social links
- Bottom bar: Copyright + legal links

## Images

**Hero Image:**
- **Type:** Professional video editing interface with AI elements overlay
- **Mood:** Dark, sophisticated, high-tech
- **Content:** Laptop/desktop screen showing video timeline with AI analysis graphics, color-graded in blue/purple tones
- **Placement:** Full-width background, gradient overlay (from transparent to bg-gray-950) for readability
- **Treatment:** Subtle blur on edges, sharp center focus

**Optional Section Images:**
- Workbook preview screenshots within feature cards
- User testimonial headshots (circular, border in accent color)

## Icons
**Library:** Heroicons (outline style for navigation, solid for actions)
- Workbook sections: Custom representative icons per section (lightbulb, chart, diagram, clock, calendar)
- UI actions: Standard heroicons (chevrons, check marks, X)

## Accessibility
- WCAG AAA contrast ratios on dark backgrounds
- Focus visible states with accent color rings (ring-2 ring-accent ring-offset-2 ring-offset-gray-900)
- Skip to content link
- ARIA labels on all interactive elements
- Keyboard navigation through wizards