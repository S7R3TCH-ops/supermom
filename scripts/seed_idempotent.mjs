/**
 * Idempotent & Diverse Seeding Script for Supermom v2.0
 * Prevents duplicates by checking for existing clients/services.
 * Adds rich, diverse scenarios (ADHD focus, unpaid past jobs, etc.)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'jlundie@gmail.com';
const BUSINESS_NAME = 'Supermom for Hire';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

function log(step, msg) { console.log(`[${step}] ${msg}`); }
function die(step, err) { console.error(`[${step}] FAILED:`, err.message ?? err); process.exit(1); }

async function getBusiness() {
  const { data, error } = await sb.from('businesses').select('id').eq('name', BUSINESS_NAME).maybeSingle();
  if (error) die('biz', error);
  if (!data) die('biz', 'Business not found. Run standard seed first.');
  return data;
}

const NEW_CLIENTS = [
  {
    first_name: 'Tony', last_name: 'Stark',
    phone: '6475550007', email: 'tony.s@example.com',
    street: '10880 Malibu Point', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['VIP', 'Tech'],
    notes: 'Lots of sensitive electronics. Do not use magnets.',
    ai_context: {
      prefs: 'Antistatic cloths only for the lab. Likes sparkling water.',
      access: 'AI "JARVIS" will grant access via retina scan (or just use the keypad 3000).',
      comms: 'Prefers holographic messages (or just Slack/Email).',
      personal: 'Very busy, often forgets he scheduled. Needs "Upcoming" reminders.',
      vip: true, recurrence: 'biweekly',
    },
  },
  {
    first_name: 'Wanda', last_name: 'Maximoff',
    phone: '6475550008', email: 'wanda.m@example.com',
    street: '2800 Sherwood Terrace', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['One-time'],
    notes: 'House feels... different every time. Just go with the flow.',
    ai_context: {
      prefs: 'Prefers 50s style cleaning products. No "red" sparks please.',
      access: 'Front door is usually open in Westview.',
      comms: 'Replies via handwritten notes left on the counter.',
      personal: 'Recently moved. Likes vintage decor.',
      vip: false, recurrence: null,
    },
  },
  {
    first_name: 'Logan', last_name: 'Howlett',
    phone: '6475550009', email: 'logan.h@example.com',
    street: '1407 Graymalkin Lane', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Monthly'],
    notes: 'Very messy. Focus on the cigar smoke odor and kitchen.',
    ai_context: {
      prefs: 'Heavy duty degreaser needed. Don\'t mind the claw marks on the floor.',
      access: 'He will be in the garage. Just walk in.',
      comms: 'Grunt = Hello. Double grunt = Good job.',
      personal: 'Loves Canadian beer. Grumpy but loyal.',
      vip: false, recurrence: 'monthly',
    },
  },
  {
    first_name: 'Natasha', last_name: 'Romanoff',
    phone: '6475550010', email: 'nat.r@example.com',
    street: '12 Stealth Way', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['VIP', 'Regular'],
    notes: 'Minimalist apartment. Needs help with "disguise" organization.',
    ai_context: {
      prefs: 'Organize wigs by color. Check for hidden compartments before vacuuming.',
      access: 'Key hidden in a hollowed-out book in the hallway (War and Peace).',
      comms: 'Encrypted messages only (Signal/Telegram).',
      personal: 'Travels a lot. Needs the place "sanitized" every 2 weeks.',
      vip: true, recurrence: 'biweekly',
    },
  },
  {
    first_name: 'Steve', last_name: 'Rogers',
    phone: '6475550011', email: 'steve.r@example.com',
    street: '569 Leaman Place', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Regular'],
    notes: 'Very polite, helps with the heavy lifting. Place is always spotless anyway.',
    ai_context: {
      prefs: 'Uses traditional soap. No fancy scents. Likes everything in right angles.',
      access: 'He will always be home to greet you. Very punctual.',
      comms: 'Face-to-face only. Doesn\'t quite "get" the smartphone yet.',
      personal: 'Loves 40s music. Has a very old shield in the umbrella stand (don\'t touch).',
      vip: false, recurrence: 'weekly',
    },
  },
  {
    first_name: 'Stephen', last_name: 'Strange',
    phone: '6475550012', email: 'dr.strange@example.com',
    street: '177A Bleecker St', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['VIP', 'Special'],
    notes: 'Do NOT touch the floating cloak. Watch for shifting floors.',
    ai_context: {
      prefs: 'Only use distilled water on the artifacts. Specific incense needed for the library.',
      access: 'The door will appear when you knock three times. Usually.',
      comms: 'Messages appear in tea leaves or occasionally via raven.',
      personal: 'Very protective of his library. Former surgeon, very precise.',
      vip: true, recurrence: 'monthly',
    },
  },
  {
    first_name: 'Scott', last_name: 'Lang',
    phone: '6475550013', email: 'scott.l@example.com',
    street: '3412 Milgrom Ave', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Biweekly'],
    notes: 'Small apartment, but somehow has a giant ant in the backyard.',
    ai_context: {
      prefs: 'Check for tiny people before stepping anywhere. Loves Baskin Robbins.',
      access: 'Key is hidden inside a toy taco.',
      comms: 'Calls often, very chatty. Tells long stories.',
      personal: 'Has a daughter named Cassie. Just trying to be a good dad.',
      vip: false, recurrence: 'biweekly',
    },
  }
];

async function seedClients(businessId) {
  let inserted = 0;
  const clientMap = {};

  // Get existing to prevent duplicates
  const { data: existing } = await sb.from('clients').select('id, email, first_name, last_name').eq('business_id', businessId).is('deleted_at', null);
  const existingEmails = new Set(existing.map(e => e.email?.toLowerCase()));
  const existingNames = new Set(existing.map(e => `${e.first_name.toLowerCase()} ${e.last_name?.toLowerCase()}`));

  for (const c of NEW_CLIENTS) {
    const nameKey = `${c.first_name.toLowerCase()} ${c.last_name?.toLowerCase()}`;
    if (existingEmails.has(c.email.toLowerCase()) || existingNames.has(nameKey)) {
      log('cli', `Skipping duplicate: ${c.first_name} ${c.last_name}`);
      const found = existing.find(e => e.email?.toLowerCase() === c.email.toLowerCase() || `${e.first_name.toLowerCase()} ${e.last_name?.toLowerCase()}` === nameKey);
      clientMap[c.email] = found.id;
      continue;
    }

    const { data, error } = await sb.from('clients').insert({ ...c, business_id: businessId }).select().single();
    if (error) die('cli-ins', error);
    clientMap[c.email] = data.id;
    inserted++;
  }

  // Also map existing ones that weren't in our NEW_CLIENTS list but might be in JOBS
  const ALL_EMAILS = [
    'sarah.c@example.com', 'bruce.w@example.com', 'peter.p@example.com', 
    'ellen.r@example.com', 'diana.p@example.com', 'clark.k@example.com'
  ];
  for (const email of ALL_EMAILS) {
    if (!clientMap[email]) {
      const found = existing.find(e => e.email?.toLowerCase() === email.toLowerCase());
      if (found) clientMap[email] = found.id;
    }
  }

  log('cli', `Processed clients. Added ${inserted} new ones.`);
  return clientMap;
}

async function getServiceMap(businessId) {
  const { data, error } = await sb.from('services').select('id, name').eq('business_id', businessId);
  if (error) die('svc', error);
  return Object.fromEntries(data.map(s => [s.name, s.id]));
}

const TODAY = new Date('2026-04-27T10:00:00'); // Today is Monday April 27
const fmtDate = (d) => d.toISOString().split('T')[0];

const NEW_JOBS = [
  // --- PAST DUE & UNPAID (ADHD Focus) ---
  { email: 'tony.s@example.com', svc: 'Deep Clean', days: -2, time: '09:00', status: 'Completed', pay: '', duration: 5.5, notes: 'The lab is finally organized.' },
  { email: 'logan.h@example.com', svc: 'Regular',    days: -5, time: '14:00', status: 'Completed', pay: '', duration: 2.0, notes: 'Cleaned the cigar lounge.' },
  { email: 'steve.r@example.com', svc: 'Regular',    days: -3, time: '08:00', status: 'Completed', pay: '', duration: 2.0, notes: 'Polished the floors to a mirror finish.' },
  
  // --- TODAY'S SCHEDULE ---
  { email: 'nat.r@example.com', svc: 'Regular',    days: 0,  time: '08:30', status: 'Scheduled', pay: '', notes: 'Sanitize all surfaces.' },
  { email: 'wanda.m@example.com', svc: 'Quick Tidy', days: 0,  time: '12:00', status: 'Scheduled', pay: '', notes: 'Match the vintage aesthetic.' },
  { email: 'tony.s@example.com', svc: 'Regular',    days: 0,  time: '15:30', status: 'Scheduled', pay: '', notes: 'Check the server room dusting.' },
  { email: 'scott.l@example.com', svc: 'Quick Tidy', days: 0,  time: '17:00', status: 'Scheduled', pay: '', notes: 'Clean the kitchen after "science experiment".' },

  // --- FUTURE ---
  { email: 'nat.r@example.com', svc: 'Regular',    days: 14, time: '08:30', status: 'Scheduled', pay: '', notes: 'Bi-weekly sanitize.' },
  { email: 'logan.h@example.com', svc: 'Deep Clean', days: 25, time: '10:00', status: 'Scheduled', pay: '', notes: 'Full estate overhaul.' },
  { email: 'dr.strange@example.com', svc: 'Deep Clean', days: 5, time: '09:00', status: 'Scheduled', pay: '', notes: 'Library organization and artifact dusting.' },
  { email: 'steve.r@example.com', svc: 'Regular',    days: 4, time: '08:00', status: 'Scheduled', pay: '', notes: 'Weekly maintenance.' },
];

async function seedJobs(businessId, clientMap, serviceMap) {
  let inserted = 0;
  
  const rows = NEW_JOBS.map(j => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + j.days);
    const dateStr = fmtDate(d);

    if (!clientMap[j.email]) {
        console.warn(`[job] Skipping job for ${j.email}: Client not found.`);
        return null;
    }
    
    return {
      business_id: businessId,
      client_id: clientMap[j.email],
      service_id: serviceMap[j.svc] || serviceMap['Regular'],
      service_name: j.svc,
      scheduled_date: dateStr,
      scheduled_time: j.time,
      job_status: j.status,
      payment_status: j.pay,
      job_notes: j.notes,
      total_amount: j.svc === 'Deep Clean' ? 250 : j.svc === 'Quick Tidy' ? 95 : 140,
      actual_duration: j.duration || null,
      estimated_hours: j.svc === 'Deep Clean' ? 5 : j.svc === 'Quick Tidy' ? 1.5 : 2.5,
      scheduling_type: 'Hard Date',
      pricing_type: 'Flat'
    };
  }).filter(Boolean);

  if (rows.length === 0) return;

  // For jobs, we check if a job already exists for that client on that day/time
  const { data: existingJobs } = await sb.from('jobs').select('client_id, scheduled_date, scheduled_time').eq('business_id', businessId).is('deleted_at', null);
  
  const finalRows = rows.filter(r => {
    const isDup = existingJobs.some(ej => 
        ej.client_id === r.client_id && 
        ej.scheduled_date === r.scheduled_date && 
        ej.scheduled_time === r.scheduled_time
    );
    return !isDup;
  });

  if (finalRows.length > 0) {
    const { error } = await sb.from('jobs').insert(finalRows);
    if (error) die('job-ins', error);
    inserted = finalRows.length;
  }

  log('job', `Processed jobs. Inserted ${inserted} new realistic jobs.`);
}

// RUN
const biz = await getBusiness();
const clientMap = await seedClients(biz.id);
const serviceMap = await getServiceMap(biz.id);
await seedJobs(biz.id, clientMap, serviceMap);

console.log('\n✅ Idempotent data seed complete!');
