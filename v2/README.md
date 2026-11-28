# Solar Home Energy V2.0 — Supabase development preview

This is the first integration milestone, under `v2/` only. The original root app has not been replaced. Do not merge or publish until browser sign-in and production data flows have been verified.

## What it does
- Uses the existing Supabase project via a public publishable key and authenticated REST calls. No service-role key, account password, telemetry export or household records are committed.
- Signs in using an existing email/password account. Sessions and retrieved records are held only in memory; refresh tokens are renewed within a session. Reloading the page requires sign-in.
- Reads daily energy statistics, settings, meter readings and purchases with row-level security.
- Shows calendar filters anchored to the latest recorded day and flags partial or missing days. Grid independence uses fully covered daily records only; it is not a live measurement.
- Uses the database function in database/solar_save_entry.sql to save readings, including atomic top-ups, with idempotent same-value retries. No persistent offline journal yet; keep the form values and timestamp on an uncertain save, then retry. An expired session requires sign-in.
- Leaves savings and payback unavailable until tariff and historical purchase migration is complete.

## Test instructions
Serve this branch using a local HTTP server or a separately configured development preview. Open /v2/index.html. Sign in with your own Supabase account. Confirm recorded totals and latest meter reading, check each tab and date period, then test an actual new reading only when you have one to record. No deployment has been configured by this change.

## Verification completed
12 pure-model assertions passed (date boundaries, missing and zero data, completeness, time conversion and invalid entry validation). Database transaction tests exercised authenticated save, identical retry, conflicting purchase, invalid reading, and water entry; all test changes rolled back. A different authenticated identity saw no existing history. Anonymous execution denied; authenticated function uses invoker rights. Existing counts after tests: 113 meter records, 36 daily summaries and no purchases. No end-to-end browser login or HTTP request test has yet been performed.

## Next milestones
Migrate the verified purchase amounts and historical tariff source from Sheets; import raw telemetry; add full V1.9.1 chart and journal parity, financial calculations, offline queue and live synchronization; test sign-in, writes and deployment. The Supabase security advisor flags leaked-password protection disabled; review availability and enable if supported by the plan. Never publish private import CSVs or secret keys.
