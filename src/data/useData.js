import { useQuery } from '@tanstack/react-query';
import { fetchClients, fetchClientById } from './clientsRepo';
import { fetchActiveJobs, fetchJobsByClientId, searchJobs } from './jobsRepo';
import { fetchExpenses } from './expensesRepo';
import { fetchWorkers, fetchWorkersWithSkills, fetchSkillTypes } from './workersRepo';
import { toDisplayClient, toDisplayJob } from './selectors';
import { initRealtime, stopRealtime } from './realtime';
import { getBusinessProfile, updateBusinessProfile, getCurrentBusinessId } from './currentBusiness';
import { notifyDataChanged } from './events';
import { fetchInvoices, fetchInvoicesByClientId } from './invoicesRepo';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { useEffect } from 'react';

export { notifyDataChanged };

export function useRealtimeSync() {
  useEffect(() => {
    initRealtime();
    return () => stopRealtime();
  }, []);
}

export function useClients() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) return { rows: [], jobs: [], paymentRows: [] };
      const businessId = bid.id || await getCurrentBusinessId();
      const [clientRows, jobRows, pmtResult] = await Promise.all([
        fetchClients(),
        fetchActiveJobs(),
        supabase.from('payments').select('job_id, amount').eq('business_id', businessId),
      ]);
      return { rows: clientRows, jobs: jobRows, paymentRows: pmtResult.data || [] };
    },
  });

  const rows = data?.rows ?? [];
  const jobs = data?.jobs ?? [];
  const paymentRows = data?.paymentRows ?? [];
  const paymentsByJobId = {};
  paymentRows.forEach(p => {
    paymentsByJobId[p.job_id] = (paymentsByJobId[p.job_id] || 0) + Number(p.amount || 0);
  });
  const display = rows.map(r => toDisplayClient(r, jobs.filter(j => j.client_id === r.id), paymentsByJobId));
  return { clients: display, raw: rows, jobs, loading, error, refresh: refetch };
}

export function useClient(id) {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['client', id],
    enabled: !!id && id !== 'null',
    queryFn: async () => {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) return { row: null, jobs: [], paymentRows: [] };
      const businessId = bid.id || await getCurrentBusinessId();
      const [c, js, pmtResult] = await Promise.all([
        fetchClientById(id),
        fetchJobsByClientId(id),
        supabase.from('payments').select('job_id, amount').eq('business_id', businessId),
      ]);
      return { row: c, jobs: js, paymentRows: pmtResult.data || [] };
    },
  });

  const row = data?.row ?? null;
  const jobs = data?.jobs ?? [];
  const paymentRows = data?.paymentRows ?? [];
  const paymentsByJobId = {};
  paymentRows.forEach(p => {
    paymentsByJobId[p.job_id] = (paymentsByJobId[p.job_id] || 0) + Number(p.amount || 0);
  });
  const display = row ? toDisplayClient(row, jobs, paymentsByJobId) : null;
  return { client: display, raw: row, jobs, loading, error, refresh: refetch };
}

export function useJobs() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) return { rows: [], clientRows: [], workerRows: [], paymentRows: [] };
      const businessId = bid.id || await getCurrentBusinessId();
      const [js, cs, ws, pmtResult] = await Promise.all([
        fetchActiveJobs(),
        fetchClients(),
        fetchWorkers({ includeArchived: true }).catch(() => []),
        supabase.from('payments').select('job_id, amount').eq('business_id', businessId),
      ]);
      return { rows: js, clientRows: cs, workerRows: ws, paymentRows: pmtResult.data || [] };
    },
  });

  const rows = data?.rows ?? [];
  const clientRows = data?.clientRows ?? [];
  const workerRows = data?.workerRows ?? [];
  const paymentRows = data?.paymentRows ?? [];
  const clientLookup = Object.fromEntries(clientRows.map(c => [c.id, toDisplayClient(c, [])]));
  const workerLookup = Object.fromEntries(workerRows.map(w => [w.id, w]));
  const paymentsByJobId = {};
  paymentRows.forEach(p => {
    paymentsByJobId[p.job_id] = (paymentsByJobId[p.job_id] || 0) + Number(p.amount || 0);
  });
  const display = rows.map(j => toDisplayJob(j, clientLookup, paymentsByJobId));
  return { jobs: display, raw: rows, clients: clientLookup, workers: workerLookup, loading, error, refresh: refetch };
}

export function useWorkers() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['workers'],
    queryFn: () => fetchWorkersWithSkills().catch(() => []),
  });
  return { workers: data ?? [], loading, error, refresh: refetch };
}

export function useSkillTypes() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['skillTypes'],
    queryFn: () => fetchSkillTypes().catch(() => []),
  });
  return { skillTypes: data ?? [], loading, error, refresh: refetch };
}

export function useExpenses() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) return [];
      return fetchExpenses();
    },
  });
  return { expenses: data ?? [], loading, error, refresh: refetch };
}

export function useBusiness() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['business'],
    queryFn: () => getBusinessProfile(),
  });

  const update = async (patch) => {
    const result = await updateBusinessProfile(patch);
    queryClient.invalidateQueries({ queryKey: ['business'] });
    return result;
  };

  return { business: data ?? null, loading, error, refresh: refetch, update };
}

export function useAiEnabled() {
  const { data } = useQuery({
    queryKey: ['ai-enabled'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('ai_enabled').eq('id', 1).single();
      if (error) return false;
      return !!data.ai_enabled;
    },
    staleTime: 60_000,
  });
  return data ?? false;
}

export function useInvoices() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => fetchInvoices(),
  });
  return { invoices: data ?? [], loading, error, refresh: refetch };
}

export function useClientInvoices(clientId) {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['client-invoices', clientId],
    enabled: !!clientId,
    queryFn: () => fetchInvoicesByClientId(clientId),
  });
  return { invoices: data ?? [], loading, error, refresh: refetch };
}

export function useSearchJobs(q, dateFrom, dateTo) {
  const { data, error, isFetching: loading } = useQuery({
    queryKey: ['job-search', q, dateFrom, dateTo],
    enabled: !!(q || dateFrom || dateTo),
    queryFn: () => searchJobs(q, dateFrom, dateTo),
  });
  return { results: data ?? [], loading, error };
}

export function useServices() {
  const { data, error, isFetching: loading, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const bid = await getCurrentBusinessId().catch(() => null);
      let query = supabase.from('services').select('*').eq('active', true);
      if (bid) query = query.eq('business_id', bid);
      const { data: rows, error: err } = await query.order('sort_order', { ascending: true });
      if (err) throw err;
      return rows || [];
    },
  });
  return { services: data ?? [], loading, error, refresh: refetch };
}
