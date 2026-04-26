import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function check() {
  const { data: users } = await sb.from('users').select('email, role, business_id, businesses(name)');
  console.log('--- User Business Links ---');
  users.forEach(u => {
    console.log(`${u.email} | Role: ${u.role} | Business: ${u.businesses?.name || 'NONE'}`);
  });
}

check();
