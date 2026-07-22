-- Worker pay data model: replaces jobs.worker_id/worker_pay/worker_paid (single
-- worker, flat boolean) with a proper job_workers assignment table + a
-- worker_payouts disbursement ledger, supporting multiple workers per job and
-- bundled payouts across jobs. See docs/plans (worker pay data model backend pass).

-- worker_payouts: one row per disbursement event (may cover 1..N jobs for one worker)
CREATE TABLE public.worker_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  amount numeric NOT NULL,
  payout_date date NOT NULL DEFAULT current_date,
  method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_payouts_pkey PRIMARY KEY (id)
);

-- job_workers: replaces jobs.worker_id/worker_pay/worker_paid. One row per worker
-- assigned to a job. payout_id is set when a worker_payouts row settles this row.
CREATE TABLE public.job_workers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  pay numeric,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  payout_id uuid REFERENCES public.worker_payouts(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_workers_pkey PRIMARY KEY (id),
  CONSTRAINT job_workers_unique UNIQUE (job_id, worker_id)
);

-- RLS: mirror worker_skills / payments exactly.
ALTER TABLE public.worker_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY worker_payouts_select ON public.worker_payouts FOR SELECT
  USING (is_admin() OR business_id = my_business_id());
CREATE POLICY worker_payouts_modify ON public.worker_payouts FOR ALL
  USING (is_admin() OR business_id = my_business_id())
  WITH CHECK (is_admin() OR business_id = my_business_id());

ALTER TABLE public.job_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_workers_select ON public.job_workers FOR SELECT
  USING (is_admin() OR business_id = my_business_id());
CREATE POLICY job_workers_modify ON public.job_workers FOR ALL
  USING (is_admin() OR business_id = my_business_id())
  WITH CHECK (is_admin() OR business_id = my_business_id());

-- Backfill from existing flat columns. paid_at left NULL for backfilled rows —
-- the real historical pay date isn't known, and that's expected/acceptable.
INSERT INTO public.job_workers (business_id, job_id, worker_id, pay, paid, paid_at)
SELECT business_id, id, worker_id, worker_pay, COALESCE(worker_paid, false), NULL
FROM public.jobs
WHERE worker_id IS NOT NULL;

-- jobs.worker_id / worker_pay / worker_paid are intentionally left in place but
-- unused after application code cuts over — dropped in a later cleanup migration
-- once confirmed (via git grep) that nothing reads them anymore.
