# Solar Home Energy V2.0 — Supabase development preview

This is the first integration milestone, under `v2/` only. The original root app has not been replaced. Do not merge or publish until browser sign-in and production data flows have been verified.

## What it does
- Uses the existing Supabase project via a public publishable key and authenticated REST calls. No service-role key, account password, telemetry export or household records are committed.
- Signs in using an existing email/password account. Sessions and retrieved records are held only in memory; refresh tokens are renewed within a session. Reloading the page requires sign-in.
- Reads daily energy statistics, settings, meter readings and purchases with row-level security.
- Shows calendar filters anchored to the latest recorded day and flags partial or missing days. Grid independence uses fully covered daily records only; it is not a live measurement.
- Uses the database function in database/solar_save_entry.sql to save readings, including atomic top-ups, with idempotent same-value retries. No persistent offline journal yet; keep the form values and timestamp on an uncertain save, then retry. An expired session requires sign-in.
- Calculates monthly estimated avoided energy cost and a provisional 2027 seasonal scenario from private Supabase tariff records. Separates recorded cash purchases from estimated energy costs; incomplete months and unverified tariffs remain labelled. Financial totals are lifetime, independent of energy range filters.

## Test instructions
Serve this branch using a local HTTP server or a separately configured development preview. Open /v2/index.html. Sign in with your own Supabase account. Confirm recorded totals and latest meter reading, check each tab and date period, then test an actual new reading only when you have one to record. No deployment has been configured by this change.

## Verification completed
12 pure-model assertions passed (date boundaries, missing and zero data, completeness, time conversion and invalid entry validation). Database transaction tests exercised authenticated save, identical retry, conflicting purchase, invalid reading, and water entry; all test changes rolled back. A different authenticated identity saw no existing history. Anonymous execution denied; authenticated function uses invoker rights. At the first integration test, counts were 113 meter records and 36 daily summaries; historical purchases were migrated in the following milestone. No end-to-end browser login or HTTP request test has yet been performed.

## Next milestones
Verify configured tariffs against municipal schedules and missing purchase slips; import raw telemetry; complete chart parity for utility history, offline queue and live synchronization; test sign-in, writes and deployment. The Supabase security advisor flags leaked-password protection disabled; review availability and enable if supported by the plan. Never publish private import CSVs or secret keys.

## Financial migration milestone
Purchase records matched against original meter timestamps; missing costs and estimated units preserved. Monthly tariff configuration for 2026–2027 imported without claiming official verification. 13 financial model assertions passed, and the committed model was exercised against the live database's daily and tariff rows. No household financial values or source spreadsheet identifiers are included in this repository. Browser and deployed HTTP tests remain outstanding.

## Detailed energy analytics milestone
Daily PV power thresholds, energy bands, battery-full durations and inverter-input low voltage durations are stored in `solar_daily`. A separately secured `solar_hourly_profile` table contains a fixed historical time-weighted 24-hour profile. Original export intervals are held at the left endpoint, split at hour boundaries, and excluded if over 120 seconds or missing either endpoint. The bands reconcile to the existing daily PV totals within rounding. All selected-date charts use daily summaries; the fixed-period hourly chart is explicitly labelled. Battery power direction remains signed, and low voltage is not treated as proof of a municipal outage. 12 new pure-model tests passed, the committed code was syntax-checked and the model was run against live Supabase data. Full raw sensor import, actual browser testing and live polling are still pending.
