# Control de pedidos

Local owner route: `/inventario`. Worker route: `/equipo/inventario`, linked from the shared clock. The dashboard sidebar and mobile navigation include Inventario.

Each printed folio is manually entered and unique (case-insensitive uppercase; leading zeros retained). A quantity of one means one pair. Each pair has a service, brand/color description, condition notes, Express (+MX$70), optional shoelaces (+MX$150), and individual received/ready/delivered state. Otros requires a manual price. There are no image uploads.

Payments are in integer MXN cents, record worker/admin identity and method, and cannot exceed the current balance. They are order bookkeeping only and do not generate Clip sales or expenses. Every create/payment/status/contact update is audited and uses an idempotency key; stale versions are rejected. Individual pairs can be collected separately. Delivery with an outstanding balance shows an explicit warning and does not record a payment.

Worker access uses the existing username/PIN authentication internally and its durable throttling. The separate HttpOnly inventory cookie has a 20-minute absolute expiry; the worker UI locks after five idle minutes. Workers can read and update orders but cannot access the owner's personnel or financial API. Shared clock actions do not retain a worker identity. No inventory data is stored in localStorage.

Storage uses private `personnel.inventory_orders`, `inventory_events`, and `inventory_requests` in the existing Supabase Postgres database. Apply `supabase/inventory.sql` with the server database connection before serving these routes. All tables have RLS enabled and browser-role grants revoked. Test fixtures are removed by their own IDs only.

## Retention

Orders with any uncollected pair or unpaid balance are retained indefinitely, including paid orders older than three months. Pairs ready for over two months are highlighted. Only fully delivered, fully paid orders become eligible for removal three calendar months after the final delivery. The daily `/api/cron/inventory-cleanup` job requires the existing `CRON_SECRET` and explicit `INVENTORY_CLEANUP_ENABLED=true`; it is disabled by default until independent backups and a restore test are verified. When enabled, it cascades to that order's events and request receipts. The cron change is local until deployed. No cleanup has been run against business orders during development.

## Checks

`npm run build`; `node --experimental-strip-types --test tests/inventory.test.ts`; `PERSONNEL_TEST_DATABASE_URL=... node --experimental-strip-types --test tests/inventory-postgres.test.ts`.

The database test creates its own order, verifies mixed services, advance/final payment, duplicate folios, retried payments, version conflicts, individual pickup, and private-table permissions, then deletes only its fixture.

## Mobile entry and save flow

Order detail uses a compact customer/balance header, side-by-side pairs and payments on larger screens, and stacked cards on phones. Notes and audit history expand on demand. The mobile entry form pins total/save above navigation; “Mismo servicio” adds another pair with matching service/add-ons and blank description/condition notes.

A successful mutation updates the local list and detail from the authoritative POST response instead of waiting for list and detail GETs. Background polling pauses while creating/viewing an order. Request generations discard outdated read responses. Inventory handlers perform their own authentication, avoiding duplicate Supabase calls in the proxy; worker inventory cookies are verified before trying owner authentication. Permissions and durable save acknowledgments remain required.

## Completion and customer notice

Order progress counts ready or already delivered pairs as finished work. An order stays En proceso (or Entrega parcial for a previous pickup) until every pair is finished. The list and detail show a native accessible progress bar, finished/total count, and percentage. Work queues count wholly completed orders, while pair inventory totals count individual pairs. Delivery and payment remain independent states.

Only a completed, not fully delivered order shows the completion-message WhatsApp action. It opens a prefilled draft for the operator to review and send; it does not send automatically or record a sent notification. “Ya notifiqué al cliente” requires an explicit confirmation and contact method before the server stores the actor, timestamp, method and recipient. No notification has been sent during verification.


## Notification queues and corrections

“Sin notificar” includes completed, uncollected orders without a confirmed notice. “Por recoger” includes completed orders whose notice was confirmed. Delivered orders leave both queues. Express work and overdue pickup sort first. Opening WhatsApp only opens a draft; confirmed notices are staff attestations, not WhatsApp delivery/read receipts.

Workers can correct a ready pair back to processing or correct a notice with a reason. Reopening a pair or changing the contact phone invalidates the current notice; audit history retains the earlier notice. Only the owner can void an incorrectly recorded payment. Voiding preserves the original record and recalculates the balance; it does not issue a refund.

Verification covers partial completion, explicit notice confirmation, retries, audit persistence, invalidation, unauthorized payment correction, and reopening a balance. Disposable test records are removed by exact ID and folio. Local development currently shares the production database; create a separate development project before broader testing or migrations.

## Recovery planning (reviewed 2026-11-03)

The linked Supabase Marketplace plan is Free. Measured database size was approximately 12.4 MB of a 500 MB quota. Receipt storage has a separate 1 GB quota. A growth forecast needs a measured intake rate; three-month order cleanup does not bound payroll, expenses, archived deposits, receipt files, or uncollected/unpaid orders.

No scheduled independent backup or successful full restore was verified. Local migration copies are not a backup schedule. Recommended minimum: encrypted nightly database export (including application schemas, personnel and inventory, auth data/roles where supported), separate receipt-object backup with metadata, offsite versioned retention (30 daily + 12 monthly copies), failure alerts, and a quarterly restore into an isolated database. Keep backup encryption keys separately and restrict access. Decide how much data loss is acceptable: a nightly backup can lose up to a day of changes; hourly backups or point-in-time recovery are needed for a smaller window.

Supabase Pro currently starts at US$25/month with seven days of daily database backups. These do not include Storage API objects. Deleting the Supabase project deletes its hosted backups too. Free projects may pause after low activity; paid plans avoid inactivity pausing. Enable account MFA and keep production separate from local testing. Monitor database, object storage, and bandwidth at 70%/85%; actual provider usage should be reviewed monthly. Do not enable destructive cleanup until an independent restore is proven.

Sources: https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/platform/free-project-pausing ; https://supabase.com/docs/guides/platform/delete-project . No paid upgrade or backup destination was configured by this local UI change.

## Undo accidental delivery

The owner can use **Corregir entrega** on a delivered pair, with a mandatory reason. The server returns only that pair to `ready`, removes its delivery timestamp, preserves payments, ready timestamp and customer notification, and appends an audit event. Workers cannot perform or replay this action. Version checks and idempotency protect concurrent changes. An uncollected pair makes the order ineligible for cleanup again.

## Expense recovery

Apply `supabase/expense-recovery.sql` before deploying the updated expenses API. It adds soft-deletion metadata to `public.expenses` and a private `personnel.expense_events` audit table. It preserves existing amounts, dates and receipt references. Egresos → **Eliminados** lists removed expenses across dates and restores them to their original dates and totals. The API requires owner authorization, same-origin writes and the exact current version; deletion/restoration and audit writes share a transaction. There is no permanent purge UI. Request generations prevent old fetch responses from overwriting refreshed expense totals.

## Final local verification (2026-11-03)

The complete suite passed: 38 tests, zero failures or skips, including five real PostgreSQL integration tests. The optimized Next.js webpack build and scoped ESLint checks passed. Browser verification covered shared-phone PIN login/handoff, attendance entry/exit, inventory reentry, expense removal/restoration and correcting an accidental delivery. Temporary fixtures were verified and removed by their own IDs; business records were not edited. Local development still uses the existing Supabase database. No production deployment or GitHub upload was performed for these changes.
