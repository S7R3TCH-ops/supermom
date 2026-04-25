import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { notifyDataChanged } from './useData';

let channel = null;

export async function initRealtime() {
  if (channel) return;

  const businessId = await getCurrentBusinessId();
  if (!businessId) return;

  channel = supabase
    .channel('schema-db-changes')
    // Listen to the 4 core tables Sandra interacts with
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'jobs', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clients', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payments', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expense_log', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .subscribe((status) => {
      console.log(`[realtime] Subscription status: ${status}`);
    });
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
