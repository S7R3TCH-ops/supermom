import { queryClient } from '../lib/queryClient';

export const CHANGE_EVENT = 'supermom:data-changed';
let _debounceTimer = null;

export function notifyDataChanged() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    window.dispatchEvent(new Event(CHANGE_EVENT));
    queryClient.invalidateQueries();
  }, 300);
}
