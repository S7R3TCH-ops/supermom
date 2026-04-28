import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

async function verify() {
  console.log('--- Auth Users Check ---');
  const { data: { users }, error } = await sb.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  for (const user of users) {
    const { data: profile } = await sb.from('users').select('role, business_id').eq('id', user.id).maybeSingle();
    console.log(`Email: ${user.email.padEnd(25)} ID: ${user.id} Role: ${profile?.role || 'N/A'} Biz: ${profile?.business_id || 'N/A'}`);
  }
  
  console.log('\n--- Businesses Check ---');
  const { data: businesses } = await sb.from('businesses').select('id, name, owner_name');
  for (const biz of businesses) {
    console.log(`Biz: ${biz.name.padEnd(25)} ID: ${biz.id} Owner: ${biz.owner_name}`);
  }
}

verify();
