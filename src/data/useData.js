// Lightweight data hooks built on the repos. Auto-fetch on mount and
// re-fetch whenever a mutation dispatches `supermom:data-changed`.

import { useCallback, useEffect, useState } from 'react';
import { fetchClients, fetchClientById } from './clientsRepo';
import { fetchActiveJobs, fetchJobsByClientId } from './jobsRepo';
import { toDisplayClient, toDisplayJob } from './selectors';
import { initRealtime } from './realtime';

const CHANGE_EVENT = 'supermom:data-changed';
export function notifyDataChanged() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useRealtimeSync() {
  useEffect(() => {
    initRealtime();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useRealtimeSync();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientRows, jobRows] = await Promise.all([fetchClients(), fetchActiveJobs()]);
      setRows(clientRows);
      setJobs(jobRows);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useChangeListener(refresh);

  const display = rows.map(r => toDisplayClient(r, jobs.filter(j => j.client_id === r.id)));
  return { clients: display, raw: rows, jobs, loading, error, refresh };
}

export function useClient(id) {
  const [row, setRow] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, js] = await Promise.all([fetchClientById(id), fetchJobsByClientId(id)]);
      setRow(c);
      setJobs(js);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  useChangeListener(refresh);

  const display = row ? toDisplayClient(row, jobs) : null;
  return { client: display, raw: row, jobs, loading, error, refresh };
}

export function useJobs() {
  const [rows, setRows] = useState([]);
  const [clientRows, setClientRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [js, cs] = await Promise.all([fetchActiveJobs(), fetchClients()]);
      setRows(js);
      setClientRows(cs);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useChangeListener(refresh);

  const clientLookup = Object.fromEntries(
    clientRows.map(c => [c.id, toDisplayClient(c, [])])
  );
  const display = rows.map(j => toDisplayJob(j, clientLookup));
  return { jobs: display, raw: rows, clients: clientLookup, loading, error, refresh };
}
