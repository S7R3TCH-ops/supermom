import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey);

async function inspect() {
  const { data: biz } = await sb.from('businesses').select('id, name, owner_name');
  console.log('--- Businesses ---');
  console.table(biz);

  const { data: users } = await sb.from('users').select('id, email, business_id, role');
  console.log('\n--- Users ---');
  console.table(users);
}

inspect();
