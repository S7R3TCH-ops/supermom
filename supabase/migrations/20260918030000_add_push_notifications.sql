-- Web Push subscriptions + dispatch log for the lockscreen job-notifications
-- feature (leave-time + wrap-up alerts). Written client-side (RLS insert,
-- user_id = auth.uid()) by src/hooks/usePushSubscription.js; read by the
-- reminders sweep (service role, api/reminders/[action].js 'sweep') to
-- dispatch alerts to the business owner's subscribed devices.
--
-- NOT auto-applied — run this in the Supabase SQL Editor manually, same as
-- every other migration in this repo. is_admin() / my_business_id() exist
-- live only (no committed migration defines them — see client_requests's
-- migration for the same note).
--
-- After this: run supabase/migrations/20260918040000_reminders_sweep_cron.sql
-- (separate file, same manual-run convention) to schedule the pg_cron sweep.

CREATE TABLE public.push_subscriptions (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id   uuid NOT NULL REFERENCES public.businesses(id),
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,             -- subscription.getKey('p256dh'), base64url
  auth          text NOT NULL,             -- subscription.getKey('auth'),   base64url
  user_agent    text,                      -- for the Settings "this phone" label + Admin tail
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),   -- touched <= once/day by the client
  last_success_at timestamptz,             -- last 2xx from the push service
  fail_count    int  NOT NULL DEFAULT 0,   -- consecutive non-404/410 failures; row deleted at 5
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);
CREATE INDEX push_subscriptions_business_idx ON public.push_subscriptions (business_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Own rows only. is_admin() can see all (Admin page tail). The sweep uses the
-- service-role key and bypasses RLS.
CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT
  USING (is_admin() OR user_id = auth.uid());
CREATE POLICY push_subscriptions_modify ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND business_id = my_business_id());

-- One row per dispatched job alert. The UNIQUE key includes the job-start
-- snapshot so a rescheduled job naturally earns a fresh alert without any
-- reconcile step. Also the double-send guard: the sweep INSERTs this row
-- FIRST (ON CONFLICT DO NOTHING) before sending anything — zero rows back
-- means another tick already claimed it.
CREATE TABLE public.push_log (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES public.businesses(id),
  job_id         uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('leave', 'wrapup')),
  job_start_at   timestamptz NOT NULL,     -- snapshot of the job's start when this fired
  fired_at       timestamptz NOT NULL DEFAULT now(),
  title          text NOT NULL,
  body           text NOT NULL,            -- exactly what was sent (Admin tail / debugging)
  sent_count     int  NOT NULL DEFAULT 0,  -- subscriptions that got a 2xx
  failed_count   int  NOT NULL DEFAULT 0,
  CONSTRAINT push_log_pkey PRIMARY KEY (id),
  CONSTRAINT push_log_job_kind_start_unique UNIQUE (job_id, kind, job_start_at)
);
CREATE INDEX push_log_business_fired_idx ON public.push_log (business_id, fired_at DESC);

ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_log_select ON public.push_log FOR SELECT
  USING (is_admin() OR business_id = my_business_id());
-- No client-side writes: only the service-role sweep inserts/updates.

-- Per-tenant switch. Default ON: it costs nothing and only reaches the
-- owner's own devices (contrast sms_reminders_enabled from the separate,
-- not-yet-built SMS design, which defaults OFF because it texts third parties).
ALTER TABLE public.businesses ADD COLUMN push_alerts_enabled boolean NOT NULL DEFAULT true;

-- Shared sweep heartbeat (single-row table, see 20260713215451). Named
-- generically ("reminders", not "push") because this same sweep function
-- (api/reminders/[action].js) is designed to carry the separately-approved
-- SMS-reminders sweep steps later, per that design's own §2.4 fallback: push
-- built the shared function first since SMS's Twilio Phase-0 wasn't done yet.
-- No rename needed when SMS lands.
ALTER TABLE public.app_settings ADD COLUMN reminders_last_sweep_at timestamptz;      -- written first thing every tick
ALTER TABLE public.app_settings ADD COLUMN reminders_last_sweep_error text;         -- set when a tick throws after the heartbeat; cleared on the next clean tick
