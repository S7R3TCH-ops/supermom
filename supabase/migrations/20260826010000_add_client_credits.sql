-- Client account credit: overpayment auto-carries forward as credit toward
-- the client's next job instead of being silently absorbed as an untracked
-- tip. Append-only ledger; available balance = SUM(amount) for a client.
-- 'issued' rows are positive (overpay on a job), 'applied'/'reclassified_to_tip'
-- rows are negative (credit consumed by a later job, or reclassified as a tip
-- instead of credit). See docs/plans (client credit design, 2026-08-26).

CREATE TABLE public.client_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  job_id uuid REFERENCES public.jobs(id),
  amount numeric(10,2) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('issued', 'applied', 'reclassified_to_tip')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_credits_pkey PRIMARY KEY (id)
);

-- RLS: mirror job_workers / worker_payouts exactly.
ALTER TABLE public.client_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_credits_select ON public.client_credits FOR SELECT
  USING (is_admin() OR business_id = my_business_id());
CREATE POLICY client_credits_modify ON public.client_credits FOR ALL
  USING (is_admin() OR business_id = my_business_id())
  WITH CHECK (is_admin() OR business_id = my_business_id());
