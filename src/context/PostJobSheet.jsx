import { useState } from 'react';
import { PostJobSheetContext } from './PostJobSheetContext';
import PostJobSheetUI from '../components/sheets/PostJobSheet';

export function PostJobSheetProvider({ children }) {
  const [jobId, setJobId] = useState(null);
  return (
    <PostJobSheetContext.Provider value={{ openPostJob: setJobId, closePostJob: () => setJobId(null) }}>
      {children}
      {jobId && <PostJobSheetUI jobId={jobId} onClose={() => setJobId(null)} />}
    </PostJobSheetContext.Provider>
  );
}
