// Minimal one-time provisioning — creates the admin user + their business +
// the users link row + the default services catalog. NO clients or jobs:
// you'll add those through the app yourself.
//
// Idempotent: re-running won't duplicate rows.
//
// Run: node scripts/provision.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'jlundie@gmail.com';
const ADMIN_PASSWORD = 'TempPass2026!';
const BUSINESS_NAME = 'Supermom for Hire';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function log(step, msg) { console.log(`[${step}] ${msg}`); }
function die(step, err) { console.error(`[${step}] FAILED:`, err.message ?? err); process.exit(1); }

const SERVICES = [
  { name: 'Deep Clean',       pricing_type: 'Flat',   default_price: 185, sort_order: 1 },
  { name: 'Regular',          pricing_type: 'Flat',   default_price: 120, sort_order: 2 },
  { name: 'Quick Tidy',       pricing_type: 'Flat',   default_price: 85,  sort_order: 3 },
  { name: 'Organize',         pricing_type: 'Flat',   default_price: 160, sort_order: 4 },
  { name: 'Declutter + Org.', pricing_type: 'Flat',   default_price: 240, sort_order: 5 },
  { name: 'Move Out',         pricing_type: 'Flat',   default_price: 320, sort_order: 6 },
  { name: 'Custom',           pricing_type: 'Hourly', default_price: 60,  sort_order: 7 },
];

// 1. Auth user
const { data: list, error: listErr } = await sb.auth.admin.listUsers();
if (listErr) die('auth', listErr);
let user = list.users.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
if (user) {
  log('auth', `user already exists: ${user.email}`);
} else {
  const { data, error } = await sb.auth.admin.createUser({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true,
    user_metadata: { full_name: 'Joel Lundie' },
  });
  if (error) die('auth', error);
  user = data.user;
  log('auth', `created ${user.email}`);
}

// 2. Business
let { data: business } = await sb.from('businesses').select('*').eq('name', BUSINESS_NAME).maybeSingle();
if (business) {
  log('biz', `exists`);
} else {
  const { data, error } = await sb.from('businesses').insert({
    name: BUSINESS_NAME, owner_name: 'Sandra',
    email: 'sandra@supermomforhire.com', phone: '6475550100',
    city: 'Georgetown', province: 'ON',
    hourly_rate: 60, hst_rate: 0.13, tax_enabled: false,
  }).select().single();
  if (error) die('biz', error);
  business = data;
  log('biz', `created`);
}

// 3. Users link
const { data: existingLink } = await sb.from('users').select('*').eq('id', user.id).maybeSingle();
if (existingLink) {
  log('user', `link exists`);
} else {
  const { error } = await sb.from('users').insert({
    id: user.id, business_id: business.id,
    first_name: 'Joel', last_name: 'Lundie', email: user.email,
    role: 'owner', status: 'active',
  });
  if (error) die('user', error);
  log('user', `linked → business as owner`);
}

// 4. Services
const { data: existingSvc } = await sb.from('services').select('name').eq('business_id', business.id);
const present = new Set((existingSvc ?? []).map(s => s.name));
const toAdd = SERVICES.filter(s => !present.has(s.name)).map(s => ({ ...s, business_id: business.id, active: true }));
if (toAdd.length) {
  const { error } = await sb.from('services').insert(toAdd);
  if (error) die('svc', error);
  log('svc', `inserted ${toAdd.length} services`);
} else {
  log('svc', `all ${SERVICES.length} services present`);
}

console.log(`\n✅ ready. Log in at http://localhost:5173/ with:`);
console.log(`   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
