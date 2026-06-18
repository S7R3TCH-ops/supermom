import { useCallback, useMemo, useState, lazy, Suspense } from 'react';
import { JobDetailSheetContext } from './JobDetailSheetContext';
const JobDetailSheet = lazy(() => import('../components/sheets/JobDetailSheet'));

export function JobDetailSheetProvider({ children }) {
  const [jobId, setJobId] = useState(null);
  const openJob  = useCallback((id) => setJobId(id),   []);
  const closeJob = useCallback(()   => setJobId(null), []);
  const value    = useMemo(() => ({ openJob, closeJob, jobId }), [openJob, closeJob, jobId]);
  return (
    <JobDetailSheetContext.Provider value={value}>
      {children}
      {jobId != null && <Suspense fallback={null}><JobDetailSheet jobId={jobId} onClose={closeJob} /></Suspense>}
    </JobDetailSheetContext.Provider>
  );
}
