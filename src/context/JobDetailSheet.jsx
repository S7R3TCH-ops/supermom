import { useCallback, useMemo, useState } from 'react';
import { JobDetailSheetContext } from './JobDetailSheetContext';
import JobDetailSheet from '../components/sheets/JobDetailSheet';

export function JobDetailSheetProvider({ children }) {
  const [jobId, setJobId] = useState(null);
  const openJob  = useCallback((id) => setJobId(id),   []);
  const closeJob = useCallback(()   => setJobId(null), []);
  const value    = useMemo(() => ({ openJob, closeJob, jobId }), [openJob, closeJob, jobId]);
  return (
    <JobDetailSheetContext.Provider value={value}>
      {children}
      {jobId != null && <JobDetailSheet jobId={jobId} onClose={closeJob} />}
    </JobDetailSheetContext.Provider>
  );
}
