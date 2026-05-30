import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';

export async function fetchWorkers({ includeArchived = false } = {}) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];
  let q = supabase.from('workers').select('*').eq('business_id', businessId);
  if (!includeArchived) q = q.is('deleted_at', null);
  const { data, error } = await q.order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Fetch workers with their skills merged in (avoids PostgREST join dependency on new FK)
export async function fetchWorkersWithSkills({ includeArchived = false } = {}) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];
  let q = supabase.from('workers').select('*').eq('business_id', businessId);
  if (!includeArchived) q = q.is('deleted_at', null);
  const { data: workers, error } = await q.order('name', { ascending: true });
  if (error) throw error;
  if (!workers || workers.length === 0) return [];

  const workerIds = workers.map(w => w.id);
  const { data: skillRows } = await supabase
    .from('worker_skills')
    .select('worker_id, skill_type_id, pay_rate')
    .in('worker_id', workerIds)
    .eq('business_id', businessId);

  const skillTypeIds = [...new Set((skillRows ?? []).map(s => s.skill_type_id))];
  let typeMap = {};
  if (skillTypeIds.length > 0) {
    const { data: typeRows } = await supabase
      .from('skill_types')
      .select('id, name')
      .in('id', skillTypeIds);
    typeMap = Object.fromEntries((typeRows ?? []).map(t => [t.id, t.name]));
  }

  const skillsByWorker = {};
  (skillRows ?? []).forEach(s => {
    if (!skillsByWorker[s.worker_id]) skillsByWorker[s.worker_id] = [];
    skillsByWorker[s.worker_id].push({
      skill_type_id: s.skill_type_id,
      skill_name: typeMap[s.skill_type_id] ?? '—',
      pay_rate: s.pay_rate,
    });
  });

  return workers.map(w => ({ ...w, skills: skillsByWorker[w.id] ?? [] }));
}

export async function createWorker(fields) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('workers')
    .insert({ ...fields, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id, fields) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('workers')
    .update(fields)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveWorker(id) {
  const businessId = await getCurrentBusinessId();
  const { error } = await supabase
    .from('workers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId);
  if (error) throw error;
}

// ---- Skill Types (business-level catalog) ----

export async function fetchSkillTypes() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('skill_types')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSkillType(name) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('skill_types')
    .insert({ name: name.trim(), business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSkillType(id, name) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('skill_types')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSkillType(id) {
  const businessId = await getCurrentBusinessId();
  // Remove worker_skill entries first to avoid FK constraint
  await supabase.from('worker_skills').delete().eq('skill_type_id', id).eq('business_id', businessId);
  const { error } = await supabase
    .from('skill_types')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);
  if (error) throw error;
}

// ---- Worker Skills (per-worker assignments with pay rates) ----

export async function fetchWorkerSkills(workerId) {
  const businessId = await getCurrentBusinessId();
  if (!businessId || !workerId) return [];
  const { data: skillRows, error } = await supabase
    .from('worker_skills')
    .select('id, skill_type_id, pay_rate')
    .eq('worker_id', workerId)
    .eq('business_id', businessId);
  if (error) throw error;
  if (!skillRows || skillRows.length === 0) return [];

  const skillTypeIds = skillRows.map(s => s.skill_type_id);
  const { data: typeRows } = await supabase
    .from('skill_types')
    .select('id, name')
    .in('id', skillTypeIds);

  const typeMap = Object.fromEntries((typeRows ?? []).map(t => [t.id, t.name]));
  return skillRows.map(s => ({
    id: s.id,
    skill_type_id: s.skill_type_id,
    skill_name: typeMap[s.skill_type_id] ?? '—',
    pay_rate: s.pay_rate,
  }));
}

// Replace all worker_skills for a worker (delete + re-insert)
export async function setWorkerSkills(workerId, skills) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) throw new Error('No business');
  const { error: delError } = await supabase
    .from('worker_skills')
    .delete()
    .eq('worker_id', workerId)
    .eq('business_id', businessId);
  if (delError) throw delError;
  if (!skills || skills.length === 0) return;
  const rows = skills.map(s => ({
    business_id: businessId,
    worker_id: workerId,
    skill_type_id: s.skill_type_id,
    pay_rate: s.pay_rate != null && s.pay_rate !== '' ? Number(s.pay_rate) : null,
  }));
  const { error: insError } = await supabase.from('worker_skills').insert(rows);
  if (insError) throw insError;
}
