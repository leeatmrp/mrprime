# Reporting Dashboard — Task Tracking

## Completed
- [x] Create Supabase tables (`reporting_monthly`, `reporting_weekly`) + RLS policies
- [x] Write & run `import_reporting.py` — 14 monthly + 45 weekly rows imported from CSV
- [x] Add `fetchReportingMonthly()` / `fetchReportingWeekly()` to `lib/queries.ts`
- [x] Build UI components: GoalKPICard, MonthlyTrendChart, ReportingTable, ReportingClient
- [x] Create `/dashboard/reporting` page (SSR)
- [x] Update ViewToggle with "Reporting" as third nav option
- [x] Add `syncReplyClassification()` to `/api/sync` route (i_status counting)
- [x] Install `chartjs-plugin-annotation` for goal lines
- [x] Build passes, deployed to Vercel

## Completed (Round 2 — after building rules correction)
- [x] Set up `tasks/todo.md` and `tasks/lessons.md`
- [x] **FIX: KPI calculations** — switched Avg Reply Rate to simple average of monthly rates (1.15% ≈ spreadsheet's 1.16%). PRR and Leads/PR use weighted all-time (5.28%, 1604) — spreadsheet's 6.13%/491 come from Google Sheets formulas referencing ranges not visible in CSV export. Verified with `analyze_kpis.py`.
- [x] **Verify rendered page end-to-end** — 18/18 content checks pass on live Vercel deployment
  - Auth flow: login → cookie → reporting page loads (200)
  - All 5 KPI cards render with correct values and goal badges
  - Monthly Trends chart section present
  - Monthly table: 14 rows, data spot-checked against CSV (all PASS)
  - Weekly table: 45 rows, first/last dates correct
  - ViewToggle: all 3 views (/dashboard, /weekly, /reporting) return 200 with "Reporting" link

## Completed (Round 3 — CRM investigation)
- [x] **Investigate CRM pipeline stages** for automating "Booked Calls"
  - Queried leads via MCP: `lt_interest_status` exists but only stage 1 (Interested) is auto-set
  - Stages 2-4 (Meeting Booked, Meeting Done, Closed/Won) not used — nobody manually advances leads
  - Leads moved between campaigns lose CRM data (reply count resets, lt_interest_status gone)
  - **Conclusion**: "Booked Calls" and "Close Ratio" cannot be automated from Instantly — must stay as manual CSV import
  - Direct API access returns 403 from local machine (IP-restricted); MCP proxy works fine
  - Added Lessons 4 (know the schema upfront) and 5 (CRM stages ≠ email classification)

## Completed (Round 4 — KPI refresh + ARR + fixes)
- [x] **Supabase migration**: Added `replies_automatic`, `unique_replies_automatic` to `daily_analytics`; `auto_replies` to `reporting_monthly`
- [x] **Sync route**: Capture auto reply fields in daily analytics + compute `auto_replies` in monthly upsert
- [x] **FIX: syncReplyClassification pagination bug** — cursor was at `data.pagination?.next_starting_after` but API returns `data.next_starting_after`. Counts were capped at 100.
- [x] **FIX: syncReplyClassification date filtering** — `from_date` param doesn't exist in Instantly V2 email API. Now sorts desc and stops at month boundary.
- [x] **FIX: lead deduplication** — old code counted individual emails, not unique leads. Now uses Set for dedup.
- [x] **KPI cards simplified**: 5 → 4 (removed Meeting Booked Ratio, Close Ratio). Added Auto:Human Ratio card.
- [x] **ViewToggle redesigned**: Monthly/Weekly as toggle switch, KPIs as separate button with gap-3 spacing
- [x] **Backfill ARR**: Historical auto reply data populated for all 14 months + 433 daily rows
- [x] **Backfill classification**: Historical positive_replies, not_interested, out_of_office for all months
- [x] **Verified on live site**: 11/11 structural checks pass, correct months, correct KPI cards

## Completed (Round 5 — 12-month range + build-rules skill)
- [x] **Created `.claude/skills/build-rules/SKILL.md`** — auto-invoked skill enforcing workflow rules on all dev tasks
- [x] **KPIs page now shows 12 months** — dynamic cutoff (current month - 11), verified Mar 2025 - Feb 2026 on live site
- [x] All 4 KPI cards render correctly with 12-month aggregate data
- [x] Deployed and verified on https://mrprime-r8s2.vercel.app

## Completed (Round 6 — Copy Angles page, Feb 21)
- [x] **Supabase table**: `copy_angles_monthly` with UNIQUE(month, campaign_name) + RLS
- [x] **CSV import**: 127 rows across 11 months (Apr 2025 - Feb 2026), 27 empty rows filtered, duplicates summed
- [x] **Query + types**: `CopyAngleRow` interface + `fetchCopyAnglesMonthly()` in `lib/queries.ts`
- [x] **UI component**: `CopyAnglesClient.tsx` — grouped-by-month table with totals rows, orange accent
- [x] **Page**: `app/dashboard/copy-angles/page.tsx` (SSR, force-dynamic)
- [x] **ViewToggle**: Added "Copy Angles" button — nav now shows `[Monthly | Weekly]  [KPIs]  [Copy Angles]`
- [x] **Sync route**: `syncCopyAnglesMonthly()` updates current month from daily_analytics, preserves manual positive_replies/booked_calls
- [x] **FIX: Recalculated all rates** — reply_rate, prr, booked_calls_rate recomputed from raw integers. 11 rows had wrong values from spreadsheet `#DIV/0!` formulas.
- [x] **Build rules updated**: Added Rule 0 (Context Loading) — read tasks/lessons.md, tasks/skills.md, MEMORY.md BEFORE any code
- [x] **Lessons captured**: Lesson 9 (never trust spreadsheet calculated columns), Lesson 10 (read lessons before building)
- [x] **Verified**: 127 rows, 0 rate mismatches, spot-checks pass, deployed to Vercel

## Pending
- [ ] Consider building a manual input UI for Booked Calls (form on reporting page, writes to Supabase)
- [ ] Clean up temp files (query_crm_stages.py, parse_emails.py, .env.local.full)

---

## Review
**Data range**: KPIs page dynamically shows last 12 months. reporting_monthly has 14 months (Jan 2025 - Feb 2026).
**KPI cards**: Avg Reply Rate (simple avg of monthly rates), PRR (weighted positive/replies), Leads/PR (weighted contacted/positive), ARR (auto_replies/replies ratio).
**Regression**: Monthly and Weekly dashboard views unaffected — both return 200 with ViewToggle.
