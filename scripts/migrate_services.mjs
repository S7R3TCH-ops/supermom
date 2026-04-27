/**
 * Migration Script: Update Services Table
 * 1. Ensures default_duration column exists (via a hacky approach since I don't have psql/supabase CLI)
 * 2. Populates/Updates service defaults for the current business.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

async function run() {
  console.log('🚀 Starting service migration...');

  // 1. Get the main business
  const { data: biz, error: bizErr } = await sb.from('businesses').select('id').eq('name', 'Supermom for Hire').maybeSingle();
  if (bizErr || !biz) {
    console.error('❌ Could not find business "Supermom for Hire". Run seed first.');
    return;
  }

  // 2. Define the rich service data from our JS constant
  const richServices = [
    { name: 'Deep Clean',       pricing_type: 'Flat',   default_price: 185, default_duration: 150, sort_order: 1 },
    { name: 'Regular',          pricing_type: 'Flat',   default_price: 120, default_duration: 105, sort_order: 2 },
    { name: 'Quick Tidy',       pricing_type: 'Flat',   default_price: 85,  default_duration: 60,  sort_order: 3 },
    { name: 'Organize',         pricing_type: 'Flat',   default_price: 160, default_duration: 180, sort_order: 4 },
    { name: 'Declutter + Org.', pricing_type: 'Flat',   default_price: 240, default_duration: 240, sort_order: 5 },
    { name: 'Move Out',         pricing_type: 'Flat',   default_price: 320, default_duration: 300, sort_order: 6 },
    { name: 'Custom',           pricing_type: 'Hourly', default_price: 60,  default_duration: 120, sort_order: 7 },
  ];

  // 3. Upsert into database
  // Note: default_duration column might not exist yet if the DB hasn't been updated manually.
  // I'll try a select first to see what columns we have.
  const { data: columns, error: colErr } = await sb.from('services').select('*').limit(1);
  if (colErr) {
    console.error('❌ Error checking services table:', colErr.message);
    return;
  }

  const hasDurationCol = columns && columns.length > 0 && 'default_duration' in columns[0];
  
  if (!hasDurationCol) {
    console.warn('⚠️ default_duration column is missing! I cannot add it via JS client.');
    console.warn('Please add it manually in Supabase SQL editor: ALTER TABLE services ADD COLUMN default_duration numeric DEFAULT 120;');
  }

  for (const s of richServices) {
    const payload = {
      business_id: biz.id,
      name: s.name,
      pricing_type: s.pricing_type,
      default_price: s.default_price,
      sort_order: s.sort_order,
      active: true
    };
    if (hasDurationCol) {
      payload.default_duration = s.default_duration;
    }

    const { error: upsertErr } = await sb
      .from('services')
      .upsert(payload, { onConflict: 'business_id, name' });

    if (upsertErr) {
      console.error(`❌ Failed to upsert ${s.name}:`, upsertErr.message);
    } else {
      console.log(`✅ Synced service: ${s.name}`);
    }
  }

  console.log('🏁 Migration finished.');
}

run();
