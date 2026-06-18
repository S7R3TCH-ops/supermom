import { useState, lazy, Suspense } from 'react';
import { PostJobSheetContext } from './PostJobSheetContext';
const PostJobSheetUI = lazy(() => import('../components/sheets/PostJobSheet'));

export function PostJobSheetProvider({ children }) {
  const [jobId, setJobId] = useState(null);
  return (
    <PostJobSheetContext.Provider value={{ openPostJob: setJobId, closePostJob: () => setJobId(null) }}>
      {children}
      {jobId && <Suspense fallback={null}><PostJobSheetUI jobId={jobId} onClose={() => setJobId(null)} /></Suspense>}
    </PostJobSheetContext.Provider>
  );
}
