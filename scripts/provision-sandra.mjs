import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SANDRA_EMAIL = 'sandra@supermomforhire.com';
const SANDRA_PASSWORD = 'Supermom2026!'; // Temporary
const BUSINESS_NAME = 'Supermom for Hire';

const SERVICES = [
  { name: 'Deep Clean',       pricing_type: 'Flat',   default_price: 185, sort_order: 1 },
  { name: 'Regular',          pricing_type: 'Flat',   default_price: 120, sort_order: 2 },
  { name: 'Quick Tidy',       pricing_type: 'Flat',   default_price: 85,  sort_order: 3 },
  { name: 'Organize',         pricing_type: 'Flat',   default_price: 160, sort_order: 4 },
  { name: 'Declutter + Org.', pricing_type: 'Flat',   default_price: 240, sort_order: 5 },
  { name: 'Move Out',         pricing_type: 'Flat',   default_price: 320, sort_order: 6 },
  { name: 'Custom',           pricing_type: 'Hourly', default_price: 60,  sort_order: 7 },
];

async function provision() {
  console.log('🌟 Provisioning Sandra\'s Business...');

  // 1. Create Sandra's Auth User
  console.log('  Ensuring Sandra\'s auth account...');
  const { data: list } = await sb.auth.admin.listUsers();
  let sandraAuth = list.users.find(u => u.email === SANDRA_EMAIL);
  
  if (!sandraAuth) {
    const { data, error } = await sb.auth.admin.createUser({
      email: SANDRA_EMAIL,
      password: SANDRA_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Sandra' }
    });
    if (error) { console.error('  ❌ Error creating auth:', error.message); return; }
    sandraAuth = data.user;
    console.log('  ✅ Sandra auth created.');
  } else {
    console.log('  ✅ Sandra auth already exists.');
  }

  // 2. Create the Business
  console.log('  Creating business "Supermom for Hire"...');
  const { data: biz, error: bizErr } = await sb.from('businesses').insert({
    name: BUSINESS_NAME,
    owner_name: 'Sandra',
    email: SANDRA_EMAIL,
    phone: '6475550100',
    city: 'Georgetown',
    province: 'ON',
    hourly_rate: 60,
    tax_enabled: false
  }).select().single();

  if (bizErr) { console.error('  ❌ Error creating business:', bizErr.message); return; }
  console.log('  ✅ Business created.');

  // 3. Link Sandra as the Owner
  console.log('  Linking Sandra as business owner...');
  const { error: userErr } = await sb.from('users').insert({
    id: sandraAuth.id,
    business_id: biz.id,
    first_name: 'Sandra',
    email: SANDRA_EMAIL,
    role: 'owner',
    status: 'active'
  });

  if (userErr) { console.error('  ❌ Error linking user:', userErr.message); return; }
  console.log('  ✅ Sandra linked as owner.');

  // 4. Default Services
  console.log('  Populating service catalog...');
  const toAdd = SERVICES.map(s => ({ ...s, business_id: biz.id, active: true }));
  const { error: svcErr } = await sb.from('services').insert(toAdd);
  
  if (svcErr) { console.error('  ❌ Error creating services:', svcErr.message); return; }
  console.log('  ✅ Service catalog populated.');

  console.log('\n✨ Sandra\'s business is ready!');
  console.log(`📧 Login: ${SANDRA_EMAIL}`);
  console.log(`🔑 Pass: ${SANDRA_PASSWORD}`);
}

provision();
