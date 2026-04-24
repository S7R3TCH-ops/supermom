// Provisions the Supermom-for-Hire workspace from a clean slate:
//   1. Admin auth user (jlundie@gmail.com)
//   2. businesses row for "Supermom for Hire"
//   3. users row linking auth → business with role 'owner'
//   4. services rows from the prototype
//   5. clients rows from the prototype mock data
//   6. jobs rows from the prototype mock data
//
// Idempotent-ish: skips creating the auth user if email already exists,
// skips business/users/services if already present for the same email/name.
//
// Run: node scripts/seed.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'jlundie@gmail.com';
const ADMIN_PASSWORD = 'TempPass2026!';
const BUSINESS_NAME = 'Supermom for Hire';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

function log(step, msg) { console.log(`[${step}] ${msg}`); }
function die(step, err) { console.error(`[${step}] FAILED:`, err.message ?? err); process.exit(1); }

// ---------- 1. Auth user ----------
async function ensureAuthUser() {
  const { data: list, error } = await sb.auth.admin.listUsers();
  if (error) die('auth', error);
  let user = list.users.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (user) {
    log('auth', `user already exists: ${user.email} (${user.id})`);
    return user;
  }
  const { data, error: createErr } = await sb.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Joel Lundie' },
  });
  if (createErr) die('auth', createErr);
  log('auth', `created ${data.user.email} (${data.user.id})`);
  return data.user;
}

// ---------- 2. Business ----------
async function ensureBusiness() {
  const { data: existing } = await sb.from('businesses').select('*').eq('name', BUSINESS_NAME).maybeSingle();
  if (existing) { log('biz', `exists: ${existing.id}`); return existing; }
  const { data, error } = await sb.from('businesses').insert({
    name: BUSINESS_NAME,
    owner_name: 'Sandra',
    email: 'sandra@supermomforhire.com',
    phone: '6475550100',
    city: 'Georgetown',
    province: 'ON',
    hourly_rate: 60,
    hst_rate: 0.13,
    tax_enabled: false,
  }).select().single();
  if (error) die('biz', error);
  log('biz', `created ${data.id}`);
  return data;
}

// ---------- 3. Users link row ----------
async function ensureUserLink(authUser, business) {
  const { data: existing } = await sb.from('users').select('*').eq('id', authUser.id).maybeSingle();
  if (existing) { log('user', `link exists`); return existing; }
  const { data, error } = await sb.from('users').insert({
    id: authUser.id,
    business_id: business.id,
    first_name: 'Joel',
    last_name: 'Lundie',
    email: authUser.email,
    role: 'owner',
    status: 'active',
  }).select().single();
  if (error) die('user', error);
  log('user', `linked ${authUser.email} → business ${business.id} as owner`);
  return data;
}

// ---------- 4. Services ----------
const SERVICES = [
  { name: 'Deep Clean',       pricing_type: 'Flat',   default_price: 185, sort_order: 1 },
  { name: 'Regular',          pricing_type: 'Flat',   default_price: 120, sort_order: 2 },
  { name: 'Quick Tidy',       pricing_type: 'Flat',   default_price: 85,  sort_order: 3 },
  { name: 'Organize',         pricing_type: 'Flat',   default_price: 160, sort_order: 4 },
  { name: 'Declutter + Org.', pricing_type: 'Flat',   default_price: 240, sort_order: 5 },
  { name: 'Move Out',         pricing_type: 'Flat',   default_price: 320, sort_order: 6 },
  { name: 'Custom',           pricing_type: 'Hourly', default_price: 60,  sort_order: 7 },
];

async function ensureServices(business) {
  const { data: existing } = await sb.from('services').select('name').eq('business_id', business.id);
  const existingNames = new Set((existing ?? []).map(s => s.name));
  const toInsert = SERVICES.filter(s => !existingNames.has(s.name))
    .map(s => ({ ...s, business_id: business.id, active: true }));
  if (!toInsert.length) { log('svc', `all ${SERVICES.length} services already present`); return; }
  const { error } = await sb.from('services').insert(toInsert);
  if (error) die('svc', error);
  log('svc', `inserted ${toInsert.length} services`);
}

async function getServiceMap(business) {
  const { data, error } = await sb.from('services').select('id, name').eq('business_id', business.id);
  if (error) die('svc-map', error);
  return Object.fromEntries(data.map(s => [s.name, s.id]));
}

// ---------- 5. Clients ----------
const CLIENTS = [
  {
    first_name: 'Anne', last_name: 'K.',
    phone: '6475550199', email: 'anne.k@example.com',
    street: '12 Main St', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Weekly'],
    notes: '🐶 Big dog. Side door. Extra time kitchen.',
    access_info: 'Side-door key under mat. Alarm code 4829#.',
    ai_context: {
      prefs: 'Hypoallergenic products only. Fragrance-free.',
      access: 'Side-door key under mat. Alarm code 4829#.',
      comms: 'Prefers text over call. Usually replies within 1 hr.',
      personal: 'Golden retriever named Biscuit (friendly). Two kids, lives with partner Dan.',
      vip: true, recurrence: 'weekly',
    },
  },
  {
    first_name: 'Patel', last_name: 'Family',
    phone: '6475550142', email: 'rohan.patel@example.com',
    street: '48 Maple Ave', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Biweekly'],
    notes: 'Bins needed. 2nd floor office priority.',
    access_info: 'Front door — ring bell. Meera usually home.',
    ai_context: {
      prefs: 'Labelled bins preferred. Clear over opaque.',
      access: 'Front door — ring bell. Meera usually home.',
      comms: 'Email for scheduling, text for day-of.',
      personal: 'Two young kids. Home office for Rohan. Meera works from home Tues/Thurs.',
      vip: false, recurrence: 'biweekly',
    },
  },
  {
    first_name: 'Westbrook', last_name: null,
    phone: '6475550177', email: 'j.westbrook@example.com',
    street: '204 Guelph St', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Monthly'],
    notes: 'Lockbox 4829. Kitchen + bath only.',
    access_info: 'Lockbox on rear gate. Code 4829.',
    ai_context: {
      prefs: 'Standard products fine. No scents near cat.',
      access: 'Lockbox on rear gate. Code 4829.',
      comms: 'Email only — rarely checks texts.',
      personal: 'Senior widower. Rescue cat named Miso (shy). Light social call welcome after job.',
      vip: false, recurrence: 'monthly',
    },
  },
  {
    first_name: 'Chen', last_name: 'Family',
    phone: '6475550103', email: 'li.chen@example.com',
    street: '77 Delrex Blvd', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Biweekly', 'Overdue'],
    notes: '3 days overdue — nudge pending.',
    access_info: 'Front door. Lin or Wei usually home.',
    ai_context: {
      prefs: 'Eco products preferred when possible.',
      access: 'Front door. Lin or Wei usually home.',
      comms: 'Text preferred. Slow to reply — expect 1–2 days.',
      personal: 'Teenager studying for exams — keep noise low in upstairs hallway.',
      vip: false, recurrence: 'biweekly',
    },
  },
  {
    first_name: 'Marchetti', last_name: null,
    phone: '6475550155', email: 'g.marchetti@example.com',
    street: '19 Churchill Cres', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Monthly', 'VIP'],
    notes: 'Full basement project. 4hr session.',
    access_info: 'Garage side door — ask for key on arrival.',
    ai_context: {
      prefs: 'Wants before/after photos for each area.',
      access: 'Garage side door — ask for key on arrival.',
      comms: "Phone call — doesn't text.",
      personal: 'Retired. Downsizing ahead of move. Sensitive about sentimental items — ask before donating.',
      vip: true, recurrence: 'monthly',
    },
  },
  {
    first_name: 'Kim', last_name: 'Watson',
    phone: '6475550188', email: 'kim.w@example.com',
    city: 'Georgetown', province: 'ON',
    status: 'lead', tags: ['Lead'],
    notes: 'Follow-up due. Interested in biweekly deep clean.',
    ai_context: {
      prefs: 'Not yet captured.',
      access: 'Not yet captured.',
      comms: 'Found via Instagram DM. Messaged Apr 14.',
      personal: 'New lead — mentioned 3-bed semi, one cat.',
      vip: false, recurrence: null,
    },
  },
];

async function ensureClients(business) {
  const { data: existing } = await sb.from('clients').select('email').eq('business_id', business.id);
  const existingEmails = new Set((existing ?? []).map(c => c.email));
  const toInsert = CLIENTS.filter(c => !existingEmails.has(c.email))
    .map(c => ({ ...c, business_id: business.id }));
  if (!toInsert.length) { log('cli', `all ${CLIENTS.length} clients already present`); return; }
  const { error } = await sb.from('clients').insert(toInsert);
  if (error) die('cli', error);
  log('cli', `inserted ${toInsert.length} clients`);
}

async function getClientMap(business) {
  const { data, error } = await sb.from('clients').select('id, email').eq('business_id', business.id);
  if (error) die('cli-map', error);
  return Object.fromEntries(data.map(c => [c.email, c.id]));
}

// ---------- 6. Jobs ----------
// scheduled_date + scheduled_time (Toronto local).
const JOBS = [
  { client_email: 'anne.k@example.com',     service: 'Deep Clean',       date: '2026-04-22', time: '09:00', est_h: 2.5, total: 185, status: 'Scheduled', payment: 'Paid',   notes: 'Side-door key under mat. Big dog is friendly. Extra time on kitchen.' },
  { client_email: 'rohan.patel@example.com', service: 'Organize',         date: '2026-04-22', time: '13:00', est_h: 3.0, total: 160, status: 'Scheduled', payment: '',       notes: 'Bring extra bins. 2nd floor office priority.' },
  { client_email: 'j.westbrook@example.com', service: 'Quick Tidy',       date: '2026-04-22', time: '16:00', est_h: 1.0, total:  85, status: 'Scheduled', payment: '',       notes: 'Lockbox 4829. Kitchen + bathroom only.' },
  { client_email: 'anne.k@example.com',     service: 'Deep Clean',       date: '2026-04-19', time: '09:00', est_h: 2.5, total: 185, status: 'Completed', payment: 'Paid',   notes: '' },
  { client_email: 'li.chen@example.com',    service: 'Deep Clean',       date: '2026-04-12', time: '10:00', est_h: 2.0, total: 120, status: 'Completed', payment: '',       notes: '' },
  { client_email: 'g.marchetti@example.com', service: 'Declutter + Org.', date: '2026-05-03', time: '09:00', est_h: 4.0, total: 240, status: 'Scheduled', payment: '',       notes: 'Full basement project.' },
];

async function ensureJobs(business, clientMap, serviceMap) {
  const { data: existing } = await sb.from('jobs').select('id').eq('business_id', business.id);
  if ((existing ?? []).length) { log('job', `${existing.length} jobs already present — skipping seed`); return; }
  const rows = JOBS.map(j => ({
    business_id: business.id,
    client_id: clientMap[j.client_email],
    service_id: serviceMap[j.service],
    service_name: j.service,
    scheduled_date: j.date,
    scheduled_time: j.time,
    scheduling_type: 'Hard Date',
    pricing_type: 'Flat',
    estimated_hours: j.est_h,
    flat_rate: j.total,
    subtotal: j.total,
    total_amount: j.total,
    job_status: j.status,
    payment_status: j.payment,
    job_notes: j.notes,
  }));
  const { error } = await sb.from('jobs').insert(rows);
  if (error) die('job', error);
  log('job', `inserted ${rows.length} jobs`);
}

// ---------- Run ----------
const authUser = await ensureAuthUser();
const business = await ensureBusiness();
await ensureUserLink(authUser, business);
await ensureServices(business);
const serviceMap = await getServiceMap(business);
await ensureClients(business);
const clientMap = await getClientMap(business);
await ensureJobs(business, clientMap, serviceMap);

console.log('\n✅ done. log in at /  with:');
console.log(`   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
