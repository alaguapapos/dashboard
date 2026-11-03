# Personnel and worker attendance

Owner page: `/personal`, protected by the existing dashboard administrator login.
Worker page: `/equipo`, separate username and four-digit PIN session.

## Payroll rules

- Lavador: MX$360 per day worked, counted once across multiple shifts.
- Detallador: MX$90 per hour, proportional to recorded seconds, rounding cents per worker/day.
- Paid time stops at 19:00 America/Mexico_City on the date of entry. Later checkouts keep their actual timestamp but do not increase pay. A forgotten shift never resumes accruing pay the next day. Entries at/after 19:00 have no payable time.
- Breaks before the cutoff are paid. There is no automatic checkout.
- Sunday–Saturday pay week; the Saturday tile and current calendar month's labor cost refresh every 30 seconds while visible. Open shifts are estimates. Completed-period rows and CSV exports exclude open shifts.
- Monthly cost accrues by work date, not payment date. Calculated pay does not create Egresos or indicate wages have been paid.
- Each shift snapshots its role/rate. Role changes and deactivation require closing an open shift. Corrections reject overlaps/future times and record the old/new values, reason, and administrator.

## Database and migration

Runtime uses the existing Supabase Postgres database via server-only `POSTGRES_URL`. `lib/personnel/postgres.ts` uses certificate/hostname verification with the public Supabase CA and system roots. Bounded connection pools work with the Supabase transaction pooler.

The `personnel` schema contains workers, shifts, hashed sessions, login-attempt counters, correction audit, and migration metadata. RLS is enabled and schema/table/sequence privileges are revoked from public, anon, and authenticated database roles. Only server routes, after owner or worker authorization, access these tables. Existing Clip, expense and receipt tables are untouched.

Apply `supabase/personnel.sql` once before deployment. To import the earlier local preview, run with Node 22 and `POSTGRES_URL` supplied securely:

```
node --experimental-strip-types scripts/migrate-personnel.ts migration-data/personnel.sqlite
```

The script backs up SQLite under the ignored `migration-data` directory, migrates worker IDs and salted PIN hashes, shifts and corrections transactionally, and records a completion marker. It refuses to overwrite existing workers and safely skips an already-completed migration. Local sessions are not imported; workers sign in again with the same PIN. There is no SQLite fallback in production. `lib/personnel/store.ts` remains only for the legacy local test suite.

The five initial profiles (Julio, Emilio, Diego, Alejandro, Mitch) and their PIN hashes have been migrated. No PINs or database credentials belong in Git. Reset PINs through Personal → Trabajadores → Nuevo PIN.

## Authentication and consistency

Worker cookies are HttpOnly, SameSite=Strict, secure on HTTPS, with a 12-hour lifetime. Only token hashes are stored. PIN reset, username change, or deactivation revokes sessions. Five failed attempts lock a username for 15 minutes; a second hashed-network rate limit restricts bulk login attempts. Vercel's trusted forwarded IP is used in production.

All personnel operations run inside database transactions with a shared advisory lock, so simultaneous requests across instances cannot create duplicate open shifts, lose rate-limit increments, or race corrections against checkouts. Clock-in uses an idempotency key and clock-out uses the shift ID. The database also enforces one open shift per worker. Workers can only read and mutate their own attendance; they cannot access financial/admin routes. Mutations require same-origin requests.

## Verification

`npm test` runs payroll, legacy persistence, and existing financial tests. For real Postgres integration coverage, supply a dedicated test database URL as `PERSONNEL_TEST_DATABASE_URL` and run the tests. The integration test creates a uniquely named temporary worker, tests cross-connection concurrency, login throttling/revocation, cutoff calculations, audit history and database privileges, then removes only that test worker's records.

`npm run build` verifies the deployable production bundle. The Vercel project already provides `POSTGRES_URL` in production through its Supabase integration. The local development server now uses the same durable database: local attendance changes are real business records.
