-- pg_cron schedule for the reminders sweep (leave-time + wrap-up push alerts;
-- the same shared function the approved SMS-reminders design plans to extend
-- later — see api/reminders/[action].js's header comment). Run manually in
-- the Supabase SQL Editor, same as every other migration in this repo — NOT
-- auto-applied. Run this AFTER 20260918030000_add_push_notifications.sql.
--
-- Joel confirmed pg_cron + pg_net are already enabled on this project
-- (2026-09-18), so step 1 below should be a no-op confirmation, not a real change.

-- 1. Confirm the extensions are enabled (Database -> Extensions in the
--    dashboard, or run these — both are idempotent):
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Put the CRON_SECRET value in Vault — NEVER inline it in cron.job, which
--    is readable by anyone with SQL access, and never paste it into this file
--    or any other tracked doc (this repo rotated CRON_SECRET on 2026-09-15
--    specifically because a plaintext copy leaked into a tracked file).
--    Replace <PASTE_CRON_SECRET_VALUE_HERE> with the real value from Vercel's
--    CRON_SECRET env var before running this line, then don't commit that
--    edit — run it directly in the SQL Editor and discard the pasted value.
select vault.create_secret('<PASTE_CRON_SECRET_VALUE_HERE>', 'reminders_sweep_secret');

-- 3. Schedule the sweep every 5 minutes (design doc §2.3 — a 10-min tick
--    against a 5-min lead time would let an alert arrive after she should
--    already have left).
select cron.schedule(
  'supermom-reminders-sweep',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://app.supermomforhire.com/api/reminders/sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_sweep_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- 4. Verify (run a few minutes after scheduling):
select * from cron.job where jobname = 'supermom-reminders-sweep';
select reminders_last_sweep_at, reminders_last_sweep_error from public.app_settings where id = 1;
-- Also check Vercel function logs for '[reminders] sweep ok' and error_logs
-- for anything new.

-- If CRON_SECRET is ever rotated in Vercel, re-run:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'reminders_sweep_secret'),
--     '<NEW_VALUE>'
--   );
-- (Same rule as the separately-approved SMS design: rotating CRON_SECRET
-- means updating this Vault secret too, since both the daily briefing cron
-- and this sweep share the one env var.)
