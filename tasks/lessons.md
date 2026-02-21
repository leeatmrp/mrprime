# Reporting Dashboard — Lessons Learned

## Lesson 0: Subagents are for exploration, not avoiding work
- **What happened**: Tried to delegate a straightforward math analysis to a subagent instead of doing it myself.
- **Why it's wrong**: The building rules say "Offload research, exploration, and parallel analysis to subagents." Computing averages from data I already have is not research — it's the core task.
- **Rule**: Only use subagents for genuine exploration (codebase search, web research, parallel file reads). Do the actual thinking yourself.

## Lesson 0b: When spreadsheet values can't be reproduced, investigate before shipping
- **What happened**: Tried 15+ methods to reproduce 6.13% PRR and 491 Leads/PR — none matched. Root cause: the CSV "Avg" row values (contacted=4,743, PR=5) don't match computed averages (11,425 and 6.93), proving the Google Sheets formula references ranges or sheets not in the CSV export.
- **Rule**: When you can't match the source of truth, verify the raw data is correct (it is — all 14 monthly + 45 weekly rows match), use the most defensible calculation method, label it clearly, and document the discrepancy. Don't pretend the numbers match when they don't.

## Lesson 1: Don't hand-wave data mismatches
- **What happened**: KPI cards showed 5.28% PRR and 1,604 leads/PR vs spreadsheet's 6.13% and 491. I said "different calculation methods" and moved on.
- **Why it's wrong**: The whole point of the reporting page is to match the master spreadsheet. If the numbers don't match, the page is wrong.
- **Rule**: When computed values don't match the source of truth, stop and fix the calculation. Never ship wrong numbers.

## Lesson 2: Verify the rendered page, not just the build
- **What happened**: I ran `next build` and `vercel --prod`, checked DB row counts, and called it done. Never actually loaded the page in a browser.
- **Why it's wrong**: Build passing means TypeScript compiles. It doesn't mean the page renders, the chart loads, or the data displays correctly.
- **Rule**: Always verify the actual rendered output. For dashboards, that means loading the page and checking every section.

## Lesson 3: Use the project's task management files, not just built-in tools
- **What happened**: I used Claude Code's TaskCreate/TaskUpdate instead of writing to `tasks/todo.md` as the building rules specify.
- **Why it's wrong**: The building rules exist for a reason — `tasks/todo.md` persists across sessions and is human-readable. Built-in tasks disappear.
- **Rule**: Always follow the user's building rules for task management, even if built-in tools exist.

## Lesson 4: Know the API schema before the user asks
- **What happened**: User asked about CRM stages ("meetings booked etc"). I didn't immediately connect `lt_interest_status` (a field I had already seen in the `create_lead` schema) to the CRM pipeline. User had to say "you should know this."
- **Why it's wrong**: When building features against an API, I should map ALL relevant fields upfront — not discover them ad hoc when the user asks. The `lt_interest_status` field was visible in the MCP schema the entire time; I just never connected it to the "Booked Calls" problem.
- **Rule**: When integrating with an API, read the full schema once and map every field to its business meaning. Don't wait for the user to point out fields you should already know about.

## Lesson 5: CRM pipeline stages ≠ email classification (Feb 2026)
- **What happened**: Investigated whether Instantly's CRM pipeline (`lt_interest_status` 2=Meeting Booked, 3=Meeting Done, 4=Closed/Won) could automate the "Booked Calls" metric.
- **Finding**: Only stage 1 (Interested) is auto-set by Instantly when `i_status=1` on an email. Stages 2-4 require manual advancement in the UI. MrPrime is NOT manually advancing leads. Additionally, leads moved between campaigns lose their CRM data.
- **Rule**: Don't assume CRM pipeline stages are populated just because the API supports them. Verify actual usage before building automation around it. "Booked Calls" stays manual.

## Lesson 6: Verify API pagination cursor paths before shipping (Feb 2026)
- **What happened**: `syncReplyClassification` used `data.pagination?.next_starting_after` but Instantly V2 returns cursor at `data.next_starting_after` (top level). Pagination never advanced — all counts capped at first 100 results. PRR showed 200% because positive_replies was inflated.
- **Rule**: When using a paginated API, verify the cursor path by inspecting actual response shape. Test with data that requires >1 page. Never assume nested path structures.

## Lesson 7: Test API filter parameters actually work (Feb 2026)
- **What happened**: Used `from_date` parameter in Instantly email API — it doesn't exist and was silently ignored. All email counts were all-time instead of current-month. Combined with Lesson 6, this made classification data completely wrong.
- **Rule**: Before using any API filter parameter, verify it in the docs or test it explicitly. If the API doesn't return fewer results with the filter, it's being ignored.

## Lesson 8: Always verify the live page, not just the build (Feb 2026)
- **What happened**: Deployed multiple times and called it done without actually checking the live page showed correct data. User had to point out PRR was 200%.
- **Rule**: Per building-rules.md Rule 4: NEVER mark done without proving it works. For dashboards, that means loading the live URL and checking rendered values make sense. "Build passes" ≠ "works correctly."

## Lesson 9: Never trust spreadsheet calculated columns — recompute from raw values (Feb 21)
- **What happened**: Imported `booked_calls_rate` directly from CSV. Many rows had `#DIV/0!` (→ stored as 0) even when `booked_calls` and `positive_replies` had valid data (e.g. 5 positive, 3 booked → should be 60%, stored as 0%).
- **Rule**: When importing from spreadsheets, ALWAYS recompute calculated fields (`reply_rate`, `prr`, `booked_calls_rate`) from their raw components. Spreadsheet formulas break silently.
- **Same applies to**: `reply_rate` (= replies/prospects), `prr` (= positive/replies). Import the RAW integers, compute rates in code.

## Lesson 10: Read tasks/lessons.md BEFORE building (Feb 21)
- **What happened**: Started building Copy Angles page without reading the 8 existing lessons. Repeated Lesson 2 and Lesson 8 (not verifying rendered output). Would have caught the BC Rate issue too.
- **Rule**: ALWAYS read `tasks/lessons.md` and `tasks/skills.md` at the START of any session before writing code. This is now Rule 0 in build-rules.

## Lesson 11: Plan mode for continued work too — not just new tasks (Feb 21)
- **What happened**: Resumed ARR backfill work from a previous session. Had clear context from the prior plan, so skipped plan mode and jumped straight into deploying + coding. User called it out.
- **Why it's wrong**: Build Rule 1 says "Enter plan mode for ANY non-trivial task (3+ steps)." Resuming multi-step work (deploy → backfill → UI → sync fix → cleanup → verify = 6 steps) still counts. Writing the plan to `tasks/todo.md` first ensures nothing is missed and gives the user visibility.
- **Rule**: Even when continuing prior work, write the remaining steps to `tasks/todo.md` and check in BEFORE executing. "I already know the plan" is not an excuse to skip the process.

## Lesson 12: Understand API field semantics BEFORE writing formulas (Feb 21)
- **What happened**: Assumed `unique_replies` was a superset containing both human + auto replies. Wrote ARR as `auto / (total - auto)` to get human count. This produced negative numbers and 999:1 ratios because `unique_replies` is ALREADY human-only — it does NOT include auto.
- **Discovery**: Queried daily_analytics and found `unique_replies_automatic > unique_replies` in many rows. This proves they are INDEPENDENT counts from separate lead pools:
  - `unique_replies` = unique leads with HUMAN replies only
  - `unique_replies_automatic` = unique leads with AUTO replies only
  - These can overlap (same lead can have both) but are counted independently
- **Correct formula**: `ARR = unique_replies_automatic / unique_replies` (simple division, NO subtraction)
- **Rule**: Before writing any formula involving API fields, verify the field semantics by examining actual data patterns (min/max/comparisons), not by guessing from field names. "unique_replies" sounds like "all unique replies" but it means "unique human replies."

## Lesson 13: Stale data ≠ wrong formula — diagnose before changing code (Feb 21)
- **What happened**: User saw wrong ARR values. Instead of checking whether the data was stale, I changed the formula (introducing the 999:1 bug from Lesson 12). The actual problem was that Supabase data hadn't been synced since Feb 12 — auto reply counts were 0 for recent days while the API had updated them.
- **Root cause**: Instantly attributes auto replies retroactively. The daily 6am cron captures a snapshot, but auto counts increase after the snapshot. A manual sync refresh fixes it.
- **Rule**: When dashboard values look wrong, check data freshness FIRST (when was last sync? does DB match API?). Only change code if the formula itself is proven wrong. "Data is stale" and "formula is broken" are different problems requiring different fixes.
