import { createContext, useContext } from 'react';

export const AiChatSheetContext = createContext(null);

export function useAiChatSheet() {
  const ctx = useContext(AiChatSheetContext);
  if (!ctx) throw new Error('useAiChatSheet must be used inside AiChatSheetProvider');
  return ctx;
}
