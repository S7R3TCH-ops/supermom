// Lightweight data hooks built on the repos. Auto-fetch on mount and
// re-fetch whenever a mutation dispatches `supermom:data-changed`.

import { useCallback, useEffect, useState } from 'react';
import { fetchClients, fetchClientById } from './clientsRepo';
import { fetchActiveJobs, fetchJobsByClientId } from './jobsRepo';
import { fetchExpenses } from './expensesRepo';
import { fetchWorkers, fetchWorkersWithSkills, fetchSkillTypes } from './workersRepo';
import { toDisplayClient, toDisplayJob } from './selectors';
import { initRealtime, stopRealtime } from './realtime';
import { getBusinessProfile, updateBusinessProfile } from './currentBusiness';

const CHANGE_EVENT = 'supermom:data-changed';
export function notifyDataChanged() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useRealtimeSync() {
  useEffect(() => {
    initRealtime();
    return () => stopRealtime();
  }, []);
}

function useChangeListener(refresh) {
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener(CHANGE_EVENT, h);
    return () => window.removeEventListener(CHANGE_EVENT, h);
  }, [refresh]);
}

export function useClients() {
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) {
        setRows([]);
        setJobs([]);
        setPaymentRows([]);
        return;
      }
      const businessId = bid.id || await getCurrentBusinessId();
      const [clientRows, jobRows, pmtResult] = await Promise.all([
        fetchClients(),
        fetchActiveJobs(),
        supabase.from('payments').select('job_id, amount').eq('business_id', businessId),
      ]);
      setRows(clientRows);
      setJobs(jobRows);
      setPaymentRows(pmtResult.data || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  const paymentsByJobId = {};
  paymentRows.forEach(p => {
    paymentsByJobId[p.job_id] = (paymentsByJobId[p.job_id] || 0) + Number(p.amount || 0);
  });
  const display = rows.map(r => toDisplayClient(r, jobs.filter(j => j.client_id === r.id), paymentsByJobId));
  return { clients: display, raw: rows, jobs, loading, error, refresh };
}

export function useClient(id) {
  const [row, setRow] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!id || id === 'null') {
      setRow(null);
      setJobs([]);
      setPaymentRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) {
        setRow(null);
        setJobs([]);
        setPaymentRows([]);
        return;
      }
      const businessId = bid.id || await getCurrentBusinessId();
      const [c, js, pmtResult] = await Promise.all([
        fetchClientById(id),
        fetchJobsByClientId(id),
        supabase.from('payments').select('job_id, amount').eq('business_id', businessId),
      ]);
      setRow(c);
      setJobs(js);
      setPaymentRows(pmtResult.data || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  const paymentsByJobId = {};
  paymentRows.forEach(p => {
    paymentsByJobId[p.job_id] = (paymentsByJobId[p.job_id] || 0) + Number(p.amount || 0);
  });
  const display = row ? toDisplayClient(row, jobs, paymentsByJobId) : null;
  return { client: display, raw: row, jobs, loading, error, refresh };
}

export function useJobs() {
  const [rows, setRows] = useState([]);
  const [clientRows, setClientRows] = useState([]);
  const [workerRows, setWorkerRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) {
        setRows([]);
        setClientRows([]);
        setWorkerRows([]);
        return;
      }
      const [js, cs, ws] = await Promise.all([
        fetchActiveJobs(),
        fetchClients(),
        fetchWorkers({ includeArchived: true }).catch(() => []),
      ]);
      setRows(js);
      setClientRows(cs);
      setWorkerRows(ws);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  const clientLookup = Object.fromEntries(
    clientRows.map(c => [c.id, toDisplayClient(c, [])])
  );
  const workerLookup = Object.fromEntries(workerRows.map(w => [w.id, w]));
  const display = rows.map(j => toDisplayJob(j, clientLookup, workerLookup));
  return { jobs: display, raw: rows, clients: clientLookup, workers: workerLookup, loading, error, refresh };
}

export function useWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWorkersWithSkills().catch(() => []);
      setWorkers(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  return { workers, loading, error, refresh };
}

export function useSkillTypes() {
  const [skillTypes, setSkillTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSkillTypes().catch(() => []);
      setSkillTypes(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  return { skillTypes, loading, error, refresh };
}

export function useExpenses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bid = await getBusinessProfile().catch(() => null);
      if (!bid) {
        setRows([]);
        return;
      }
      const data = await fetchExpenses();
      setRows(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  return { expenses: rows, loading, error, refresh };
}

export function useBusiness() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBusinessProfile();
      setBusiness(data);
    } catch {
      // If error is just "no business", that's fine for admins
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  const update = async (patch) => {
    const data = await updateBusinessProfile(patch);
    setBusiness(data);
    return data;
  };

  return { business, loading, error, refresh, update };
}

import { getCurrentBusinessId } from './currentBusiness';
import { fetchInvoices } from './invoicesRepo';
import { supabase } from '../lib/supabase';

export function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchInvoices();
      setInvoices(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  return { invoices, loading, error, refresh };
}

export function useServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const bid = await getCurrentBusinessId().catch(() => null);
      let query = supabase
        .from('services')
        .select('*')
        .eq('active', true);
      
      if (bid) {
        query = query.eq('business_id', bid);
      }
      
      const { data, error: err } = await query.order('sort_order', { ascending: true });
      if (err) throw err;
      setServices(data || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);
  useChangeListener(refresh);

  return { services, loading, error, refresh };
}
