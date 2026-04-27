import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey);

async function inspectData() {
  const { data: clients } = await sb.from('clients').select('id, first_name, last_name, business_id');
  console.log('--- Clients ---');
  console.table(clients);

  const { data: jobs } = await sb.from('jobs').select('id, client_id, business_id, job_status');
  console.log('\n--- Jobs ---');
  console.table(jobs.slice(0, 20)); // Limit to first 20
}

inspectData();
