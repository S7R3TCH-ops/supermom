import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { notifyDataChanged } from './events';

let channel = null;
let subscribing = false;
const CHANNEL_NAME = 'schema-db-changes';

// Debounce so rapid-fire writes (e.g. updateDailyRoutes writing N jobs) only trigger one refresh
let debounceTimer = null;
function debouncedNotify() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => notifyDataChanged(), 500);
}

export async function initRealtime() {
  if (channel || subscribing) return;
  subscribing = true;

  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) return;

    // Defensive: supabase.channel(name) returns the EXISTING channel if one
    // with that name is already subscribed (survives our module-level reset
    // on HMR / Strict Mode remount). Force-remove it before recreating.
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${CHANNEL_NAME}`);
    if (existing) {
      await supabase.removeChannel(existing);
      channel = null;
    }

    channel = supabase
      .channel(CHANNEL_NAME)
      // Listen to the 4 core tables Sandra interacts with
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `business_id=eq.${businessId}` },
        () => debouncedNotify()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients', filter: `business_id=eq.${businessId}` },
        () => debouncedNotify()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `business_id=eq.${businessId}` },
        () => debouncedNotify()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_log', filter: `business_id=eq.${businessId}` },
        () => debouncedNotify()
      )
      .subscribe((status) => {
        console.log(`[realtime] Subscription status: ${status}`);
      });
  } finally {
    subscribing = false;
  }
}

export function stopRealtime() {
  subscribing = false;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
