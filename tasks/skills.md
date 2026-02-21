# MrPrime Dashboard — Architecture & Skills

## Tech Stack
- **Framework**: Next.js 16 (App Router, force-dynamic pages)
- **DB**: Supabase (PostgreSQL) — project `kyitboizdftyrcgmcuyu`
- **Charts**: Chart.js + chartjs-plugin-annotation
- **Styling**: Tailwind CSS 4, dark theme
- **Deploy**: Vercel Hobby plan, `npx vercel --prod`
- **Live**: https://mrprime-r8s2.vercel.app

## Page Routes

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Redirect to `/dashboard` |
| `/login` | `app/login/page.tsx` | Email/password auth via Supabase direct API |
| `/dashboard` | `app/dashboard/page.tsx` | Monthly view: KPIs, campaign table, daily chart, warmup |
| `/dashboard/weekly` | `app/dashboard/weekly/page.tsx` | 7-day lookback, same layout |
| `/dashboard/reporting` | `app/dashboard/reporting/page.tsx` | KPI trends, reply classification, monthly/weekly tables |
| `/dashboard/copy-angles` | `app/dashboard/copy-angles/page.tsx` | Per-campaign monthly performance, grouped by month |

## API Routes

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/api/sync` | `Bearer CRON_SECRET` | Full sync: campaigns, accounts, daily_analytics, reply classification, copy angles |
| `/api/refresh` | None | Client-callable partial sync for frontend auto-refresh |
| `/api/auth/signout` | None | Delete cookies, redirect to `/login` |

### Sync Route Functions (order matters)
1. `syncCampaigns()` — `/campaigns/analytics` → `campaigns` table
2. `syncAccounts()` — Paginated `/accounts` → `accounts` table
3. `syncDailyAnalytics()` — Last 31 days per-campaign daily data, opp reconciliation
4. `syncReplyClassification()` — Paginated `/emails` by i_status, OOO detection, monthly upsert
5. `syncCopyAnglesMonthly()` — Extracts copy angle name from campaign pattern, aggregates current month

### Copy Angle Name Extraction
Pattern: `[W]C{N} - {region} - {audience} - {copy_angle_name}`
- `extractCopyAngle()` splits on ` - `, returns parts after 3rd separator
- Multiple Instantly campaigns can map to same copy angle name

## Supabase Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `campaigns` | id, name, status, emails_sent_count, reply_count, bounce_count | Upsert on `id` |
| `accounts` | email, status, warmup_status, stat_warmup_score | Upsert on `email` |
| `daily_analytics` | date, campaign_id, new_leads_contacted, unique_replies, unique_replies_automatic, opportunities | Delete+insert per day/campaign |
| `reporting_monthly` | month (UNIQUE), total_email_sent, replies, positive_replies, auto_replies, not_interested, out_of_office | Upsert on `month` |
| `reporting_weekly` | week_start (UNIQUE), same metrics as monthly | Manual CSV import only |
| `copy_angles_monthly` | month + campaign_name (UNIQUE), total_prospects, total_replies, positive_replies, booked_calls, auto_replies | Sync updates prospects/replies/auto_replies; positive_replies/booked_calls are manual |

## Auth Approach
- **Direct fetch** to `{SUPABASE_URL}/auth/v1/token?grant_type=password` (NOT @supabase/ssr createBrowserClient — causes "Invalid value" errors)
- Cookies: `sb-access-token` (1hr), `sb-refresh-token` (7d)
- Middleware checks cookie on `/dashboard/*`, redirects to `/login`
- RLS: SELECT for `authenticated` + `anon` on all tables

## Key Metrics
- **new_leads_contacted** = "Sequence Started" (use this, NOT `sent`)
- **ARR** = auto_replies / human_replies (color: green <2:1, orange 2-3:1, red >3:1)
- **Booked Calls** = manual only (CRM stages 2-4 not used by MrPrime)
- **Bounce Rate** = all-time from campaigns table (not tracked in daily_analytics)

## Components

| Component | Type | Purpose |
|-----------|------|---------|
| `ViewToggle` | client | Nav: `[Monthly|Weekly] [KPIs] [Copy Angles]` |
| `DashboardClient` | client | Monthly view wrapper, 5min auto-refresh |
| `WeeklyClient` | client | Weekly view wrapper, 5min auto-refresh |
| `ReportingClient` | client | KPI cards + trend chart + tables |
| `CopyAnglesClient` | client | Grouped-by-month table with ARR colors, totals rows |
| `KPICard` / `GoalKPICard` | server | Metric card with color + optional goal badge |
| `CampaignTable` | server | Campaign rows with per-campaign ARR |
| `DailyChart` | client | Line chart: contacted, replies, opps (dual Y-axes) |
| `WarmupChart` | client | Doughnut: healthy/good/warning distribution |
| `MonthlyTrendChart` | client | Multi-line: reply_rate, PRR, BCR over months |
| `ReportingTable` | server | Monthly reporting data table |

## UI Theme
- Background: `#0f172a`, borders: `#1e293b`, text: `#94a3b8`
- Accent: `#f97316` (orange) for active states, totals rows
- Charts: orange (sent), cyan (replies), yellow/red/green (warmup)

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
CRON_SECRET (= mrprime-sync-2026)
INSTANTLY_API_KEY
```

## Known Constraints
- Instantly API returns 403 from local machine (IP-restricted) — use MCP proxy or Vercel routes
- Vercel Hobby plan: 1 cron job only (daily 6am UTC)
- Refresh token rotation NOT implemented (1hr session expiry)
- `daily_analytics` sync only keeps last 31 days (older data lost from Supabase, still in Instantly API)
- `reporting_weekly` is manual CSV import only (no automated sync)
