import { useCallback, useMemo, useState, lazy, Suspense } from 'react';
import { AiChatSheetContext } from './AiChatSheetContext';
const AiChatSheet = lazy(() => import('../components/sheets/AiChatSheet'));

export function AiChatSheetProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState({});
  const openChat  = useCallback((context = {}) => { setCtx(context); setOpen(true); }, []);
  const closeChat = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openChat, closeChat }), [openChat, closeChat]);
  return (
    <AiChatSheetContext.Provider value={value}>
      {children}
      {open && <Suspense fallback={null}><AiChatSheet onClose={closeChat} context={ctx} /></Suspense>}
    </AiChatSheetContext.Provider>
  );
}
