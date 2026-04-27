import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const JOEL_EMAIL = 'jlundie@gmail.com';
const SANDRA_EMAIL = 'sandra@supermom.io'; // Using the one you're likely using
const BUSINESS_NAME = 'Supermom for Hire';
const TODAY = new Date('2026-04-26T12:00:00');

async function resetAndSeed() {
  console.log('🚀 Starting deep platform reset and realistic seed...');

  // 1. Get Auth Users
  const { data: authList, error: authListErr } = await sb.auth.admin.listUsers();
  if (authListErr) die('auth-list', authListErr.message);
  const users = authList.users;
  
  const joel = users.find(u => u.email === JOEL_EMAIL);
  const sandra = users.find(u => u.email === SANDRA_EMAIL);

  if (!joel) die('reset', "Could not find Joel's admin user.");
  if (!sandra) die('reset', `Could not find Sandra's user (${SANDRA_EMAIL}).`);

  // 2. Clear EVERYTHING in correct order
  console.log('  Cleaning related tables...');
  const tables = [
    'audit_log', 'communication_log', 'notification_log', 'template_schedule',
    'job_templates', 'invoice_jobs', 'invoices', 'payments', 'expense_log',
    'jobs', 'clients', 'services', 'config'
  ];
  for (const table of tables) {
    const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn(`    ⚠️ Warning cleaning ${table}:`, error.message);
  }

  console.log('  Cleaning users and businesses...');
  // Clear user link rows first
  await sb.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Clear businesses
  const { error: bizDelErr } = await sb.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (bizDelErr) die('biz-del', bizDelErr.message);

  // 3. Create THE Business
  const { data: biz, error: bizErr } = await sb.from('businesses').insert({
    name: BUSINESS_NAME, owner_name: 'Sandra', email: SANDRA_EMAIL,
    phone: '6475550100', city: 'Georgetown', province: 'ON',
    hourly_rate: 60, hst_rate: 0.13, tax_enabled: false
  }).select().single();
  
  if (bizErr) die('biz-create', bizErr.message);
  console.log('✅ Created Business:', biz.id);

  // 4. Link Users
  const { error: userLinkErr } = await sb.from('users').insert([
    { id: joel.id, business_id: null, role: 'admin', first_name: 'Joel', email: JOEL_EMAIL, status: 'active' },
    { id: sandra.id, business_id: biz.id, role: 'owner', first_name: 'Sandra', email: SANDRA_EMAIL, status: 'active' }
  ]);
  if (userLinkErr) die('user-link', userLinkErr.message);
  console.log('✅ Linked Joel (Admin) and Sandra (Owner)');

  // 5. Seed Services
  const services = [
    { name: 'Deep Clean', pricing_type: 'Flat', default_price: 185, sort_order: 1 },
    { name: 'Regular', pricing_type: 'Flat', default_price: 120, sort_order: 2 },
    { name: 'Quick Tidy', pricing_type: 'Flat', default_price: 85,  sort_order: 3 },
    { name: 'Custom', pricing_type: 'Hourly', default_price: 60,  sort_order: 4 },
  ];
  const { data: svcRows } = await sb.from('services').insert(services.map(s => ({...s, business_id: biz.id, active: true}))).select();
  const svcMap = Object.fromEntries(svcRows.map(s => [s.name, s.id]));

  // 6. Seed Clients
  const clients = [
    { first_name: 'Sarah', last_name: 'Connor', email: 'sarah.c@example.com', street: '742 Evergreen Terrace', city: 'Georgetown', tags: ['VIP', 'Weekly'], ai_context: { prefs: 'Vinegar/water only.', access: 'Code 1984.', comms: 'Texts only.', personal: 'Son John. Privacy conscious.', vip: true } },
    { first_name: 'Bruce', last_name: 'Wayne', email: 'bruce.w@example.com', street: '1007 Mountain Drive', city: 'Georgetown', tags: ['VIP', 'Monthly'], ai_context: { prefs: 'Wood oil in pantry.', access: 'Side gate.', comms: 'Assistant Alfred.', personal: 'Away on business often.', vip: true } },
    { first_name: 'Peter', last_name: 'Parker', email: 'peter.p@example.com', street: '20 Ingram St', city: 'Georgetown', tags: ['Biweekly'], ai_context: { prefs: 'Tidy laundry only.', access: 'Loose brick.', comms: 'Distracted/bullet points.', personal: 'Aunt May. Tired.', vip: false } },
    { first_name: 'Ellen', last_name: 'Ripley', email: 'ellen.r@example.com', street: '57 Nostromo Way', city: 'Georgetown', tags: ['One-time'], ai_context: { prefs: 'Heavy duty cleaners.', access: 'Lockbox 1234.', comms: 'Direct.', personal: 'Cat Jonesy.', vip: false } },
  ];
  const { data: cliRows } = await sb.from('clients').insert(clients.map(c => ({...c, business_id: biz.id, status: 'active', province: 'ON'}))).select();
  const cliMap = Object.fromEntries(cliRows.map(c => [c.email, c.id]));

  // 7. Seed Jobs (relative to April 26, 2026)
  const fmtDate = (d, days) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x.toISOString().split('T')[0];
  };

  const jobs = [
    { email: 'sarah.c@example.com', svc: 'Regular',    days: -7, time: '09:00', status: 'Completed', pay: 'Paid', notes: 'Great job.' },
    { email: 'peter.p@example.com', svc: 'Quick Tidy', days: -4, time: '14:00', status: 'Completed', pay: 'Paid', notes: 'Found camera.' },
    { email: 'ellen.r@example.com', svc: 'Deep Clean', days: -3, time: '10:00', status: 'Completed', pay: '',     notes: 'Intense basement.' },
    { email: 'sarah.c@example.com', svc: 'Regular',    days: 0,  time: '09:00', status: 'Scheduled', pay: '',     notes: 'Robot vacuum filters.' },
    { email: 'peter.p@example.com', svc: 'Quick Tidy', days: 0,  time: '13:00', status: 'Scheduled', pay: '',     notes: 'Laundry day.' },
    { email: 'bruce.w@example.com', svc: 'Deep Clean', days: 2,  time: '08:00', status: 'Scheduled', pay: '',     notes: 'Bat mess in cave.' },
    { email: 'sarah.c@example.com', svc: 'Regular',    days: 7,  time: '09:00', status: 'Scheduled', pay: '',     notes: 'Maintenance.' },
  ];

  await sb.from('jobs').insert(jobs.map(j => ({
    business_id: biz.id, client_id: cliMap[j.email], service_id: svcMap[j.svc], service_name: j.svc,
    scheduled_date: fmtDate(TODAY, j.days), scheduled_time: j.time, job_status: j.status,
    payment_status: j.pay, job_notes: j.notes, total_amount: svcMap[j.svc] === svcMap['Deep Clean'] ? 185 : 120,
    pricing_type: 'Flat'
  })));

  console.log('✅ Seeding complete. Today is April 26, 2026.');
}

function die(step, msg) { console.error(`❌ [${step}] ${msg}`); process.exit(1); }

resetAndSeed();
