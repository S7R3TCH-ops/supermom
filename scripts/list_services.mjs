import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

const { data, error } = await sb.from('services').select('*');
if (error) {
  console.error(error);
} else {
  console.table(data);
}
process.exit();
