import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';

export async function fetchExpenses() {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('expense_log')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchExpensesByRange(start, end) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('expense_log')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createExpense(payload) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('expense_log')
    .insert({ ...payload, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteExpense(id) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('expense_log')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
