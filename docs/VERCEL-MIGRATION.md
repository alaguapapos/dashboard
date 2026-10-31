# Vercel migration status

The `migrate-vercel` branch replaces Vinext with standard Next.js 16 on Node 22. The original Sites application is unchanged. This branch must not be promoted until the checks below pass.

## Infrastructure

Install Supabase using Vercel Marketplace and connect it to the dashboard project. Supabase supplies Postgres, private receipt storage, and authentication. Apply `supabase/migration.sql` to the new project. The database tables deny direct anonymous/authenticated access: only authenticated, email-allowlisted Next.js API routes use the server service-role key.

Set variables from `.env.example` in Vercel. `CLIP_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are server secrets. `DASHBOARD_ALLOWED_EMAILS` is a comma-separated list of owner-approved addresses. The new database is used for migration testing before any production users are switched; remove test records before cutover. Use separate preview resources for future development. Create the owner's confirmed Supabase Auth account securely; do not publish passwords. Keep Vercel deployment protection enabled.

Receipt photos and PDFs upload directly to a signed staging path (10 MB maximum), avoiding Vercel's request-body limit. The save endpoint validates actual bytes and copies to a new private final path before committing the expense. Final receipt keys have no upload token. Superseded files are retained for recovery; plan an audited periodic cleanup of unreferenced objects and expired staging uploads.

## Data preservation

Clip is fetched live from the same payment and settlement APIs; no financial formula changes. Cash, card, tips, actual reported fees, Mexico City dates, and the daily float keep the existing rules.

Use `scripts/migrate-expenses.mjs export` with SOURCE_URL and SOURCE_BEARER supplied securely in the environment. Backups go into ignored `migration-data/`. Use `import`, then `verify` with destination environment variables. The script compares every field and receipt SHA-256, rejects conflicts, and never deletes source data. Capture a final source export immediately before cutover so new expenses are not missed. A source inspection on October 30, 2026 returned zero expenses and zero receipt attachments; recheck at cutover.

## Required verification before promotion

- `npm ci`, `npm test`, `npm run build` pass; `.next/routes-manifest.json` exists.
- Unauthorized API access and receipt downloads return 401; database and storage are private.
- Owner login, cookie refresh, and sign-out work on phone/tablet.
- Compare live Clip results for October 14, 20, 21, 22, and 27 with the original dashboard, including cash totals and actual settlement net.
- Create a clearly labelled test expense with a JPG/PDF; verify amount, worker, cash-register deduction, receipt download bytes, persistence across reload/deployment, editing, and deletion. Also test a file larger than 4.5 MB but below 10 MB and rejected unsupported files.
- Export/import/verify all existing expenses and receipts; compare final counts and totals after final export.
- Only then merge/promote and hand over the new URL. Keep the original Sites application available as rollback; do not allow both to receive new expenses after cutover.

## Current verification

Local Next.js build and all 11 existing domain tests passed. Supabase Free is provisioned and the schema is applied. Source and destination reconcile to zero expenses/receipts. Local authenticated API checks passed: 5 MB signed upload, byte-identical private download, edit persistence, deletion, missing-ticket rejection, and unauthenticated/cross-origin denial. Live Clip payments match the original for October 14/20/21; all 33 reported fee records in the October 20–27 comparison match. Deployed checks and browser verification remain pending. No switch has been made.
