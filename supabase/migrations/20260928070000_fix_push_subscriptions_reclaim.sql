-- Fix: push_subscriptions upsert (usePushSubscription.js, onConflict:'endpoint')
-- 401s with "new row violates row-level security policy (USING expression)"
-- when the same browser/device endpoint was previously owned by a different
-- user_id (e.g. switching accounts on one QA device without unsubscribing
-- first). endpoint is globally UNIQUE (one browser subscription = one row),
-- but the old push_subscriptions_modify policy's USING clause required the
-- CURRENT auth.uid() to already own the existing row before it could update
-- it — so a re-subscribe from a new user on the same device could never
-- reclaim the row. Root-caused 2026-09-28 from the error_logs capture in
-- bug-report 2d65845c (fired twice 2026-09-27, QA account).
--
-- Fix: drop the ownership check on UPDATE only (any authenticated user may
-- take over a device's subscription row — that's the correct behavior,
-- since the endpoint identifies the device's current owner going forward),
-- keep WITH CHECK so the row always ends up owned by the user who wrote it.
-- Split out of the old single FOR ALL policy on purpose: a FOR ALL policy's
-- USING clause also gates SELECT (permissive policies OR together), so
-- USING(true) there would let any authenticated user read every business's
-- push_subscriptions rows (endpoint/p256dh/auth are push credentials) —
-- push_subscriptions_select stays the only SELECT policy. DELETE keeps the
-- original ownership check; nothing needed it relaxed.
--
-- NOT auto-applied — run in Supabase SQL Editor manually, same as every
-- other migration in this repo.

DROP POLICY IF EXISTS push_subscriptions_modify ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND business_id = my_business_id());
CREATE POLICY push_subscriptions_update ON public.push_subscriptions FOR UPDATE
  USING (true)
  WITH CHECK (user_id = auth.uid() AND business_id = my_business_id());
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- DOWN:
-- DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
-- DROP POLICY IF EXISTS push_subscriptions_update ON public.push_subscriptions;
-- DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
-- CREATE POLICY push_subscriptions_modify ON public.push_subscriptions FOR ALL
--   USING (user_id = auth.uid())
--   WITH CHECK (user_id = auth.uid() AND business_id = my_business_id());
