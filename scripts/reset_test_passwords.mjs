import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const USERS = [
  { email: 'jlundie@gmail.com', password: 'TempPass2026!' },
  { email: 'sandra@supermom.io', password: 'TempPass2026!' }
];

async function resetPasswords() {
  const { data: { users }, error: listErr } = await sb.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr);
    return;
  }

  for (const target of USERS) {
    const authUser = users.find(u => u.email.toLowerCase() === target.email.toLowerCase());
    if (authUser) {
      console.log(`Resetting password for ${target.email}...`);
      const { error } = await sb.auth.admin.updateUserById(authUser.id, { password: target.password });
      if (error) console.error(`Failed to reset ${target.email}:`, error.message);
      else console.log(`Successfully reset ${target.email}`);
    } else {
      console.warn(`User ${target.email} not found in Auth.`);
    }
  }
}

resetPasswords();
