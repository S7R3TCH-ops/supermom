import { useCallback, useMemo, useState } from 'react';
import { AiChatSheetContext } from './AiChatSheetContext';
import AiChatSheet from '../components/sheets/AiChatSheet';

export function AiChatSheetProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState({});
  const openChat  = useCallback((context = {}) => { setCtx(context); setOpen(true); }, []);
  const closeChat = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openChat, closeChat }), [openChat, closeChat]);
  return (
    <AiChatSheetContext.Provider value={value}>
      {children}
      {open && <AiChatSheet onClose={closeChat} context={ctx} />}
    </AiChatSheetContext.Provider>
  );
}
