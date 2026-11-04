-- Add a non-payroll inventory account type. Existing workers, shifts and rates are unchanged.
BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE personnel.workers DROP CONSTRAINT IF EXISTS workers_role_check;
ALTER TABLE personnel.workers ADD CONSTRAINT workers_role_check
 CHECK(role IN ('lavador','detallador','administrador'));
COMMIT;
