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

// Skips the debounce for call sites where a sheet is about to close and
// navigate away — the 300ms window can otherwise race a fast close/nav,
// leaving the destination screen showing pre-mutation cached data until
// something else happens to trigger a refetch.
export function notifyDataChangedNow() {
  clearTimeout(_debounceTimer);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  queryClient.invalidateQueries();
}
