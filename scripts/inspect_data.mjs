import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey);

async function inspectData() {
  const { data: clients } = await sb.from('clients').select('id, first_name, last_name, email').is('deleted_at', null);
  console.log('--- Active Clients ---');
  console.table(clients);

  const { data: jobs } = await sb.from('jobs')
    .select('id, client_id, scheduled_date, scheduled_time, job_status')
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false });
  
  // Find potential job duplicates (same client, same date, same time)
  const jobCounts = {};
  const duplicates = [];
  
  jobs.forEach(j => {
    const key = `${j.client_id}::${j.scheduled_date}::${j.scheduled_time}`;
    if (!jobCounts[key]) {
      jobCounts[key] = [];
    }
    jobCounts[key].push(j);
    if (jobCounts[key].length > 1) {
      duplicates.push(key);
    }
  });

  console.log('\n--- Jobs (First 20) ---');
  console.table(jobs.slice(0, 20));

  if (duplicates.length > 0) {
    console.log('\n--- Duplicate Job Keys Found ---');
    duplicates.forEach(key => {
        const matching = jobCounts[key];
        console.log(`Key: ${key}`);
        console.table(matching);
    });
  } else {
    console.log('\nNo duplicate jobs (client+date+time) found in active records.');
  }
}

inspectData();
