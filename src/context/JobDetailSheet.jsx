import { useState } from 'react';
import { JobDetailSheetContext } from './JobDetailSheetContext';
import JobDetailSheet from '../components/sheets/JobDetailSheet';

export function JobDetailSheetProvider({ children }) {
  const [jobId, setJobId] = useState(null);

  function openJob(id) {
    setJobId(id);
  }

  function closeJob() {
    setJobId(null);
  }

  return (
    <JobDetailSheetContext.Provider value={{ openJob, closeJob }}>
      {children}
      {jobId != null && <JobDetailSheet jobId={jobId} onClose={closeJob} />}
    </JobDetailSheetContext.Provider>
  );
}
