/**
 * Realistic Seeding Script for Supermom v2.0
 * Generates a diverse set of clients and jobs (past, present, future)
 * with rich AI context notes and varying payment statuses.
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

const CLIENTS = [
  {
    first_name: 'Sarah', last_name: 'Connor',
    phone: '6475550001', email: 'sarah.c@example.com',
    street: '742 Evergreen Terrace', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['VIP', 'Weekly'],
    notes: 'Very meticulous about the kitchen. Watch out for the robot vacuum.',
    ai_context: {
      prefs: 'Uses only vinegar and water for glass. Microfiber cloths only.',
      access: 'Smart lock code 1984. Front door.',
      comms: 'Texts only. Do not call during work hours (9-5).',
      personal: 'Has a son named John. Very privacy-conscious. Likes tech talk.',
      vip: true, recurrence: 'weekly',
    },
  },
  {
    first_name: 'Bruce', last_name: 'Wayne',
    phone: '6475550002', email: 'bruce.w@example.com',
    street: '1007 Mountain Drive', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Monthly'],
    notes: 'Large estate. Focus on the study and the gym.',
    ai_context: {
      prefs: 'Polished wood needs specific oil (in the pantry). No flash photography.',
      access: 'Side entrance. Guard will let you in.',
      comms: 'Replies via assistant (Alfred). Very formal.',
      personal: 'Often away on "business". Quiet household. High security.',
      vip: true, recurrence: 'monthly',
    },
  },
  {
    first_name: 'Peter', last_name: 'Parker',
    phone: '6475550003', email: 'peter.p@example.com',
    street: '20 Ingram St', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Biweekly'],
    notes: 'Messy apartment. Lots of "webbing" in the corners.',
    ai_context: {
      prefs: 'Just tidy up the laundry. Don\'t move the science projects.',
      access: 'Window is usually open, or key under the loose brick.',
      comms: 'Fast talker, often distracted. Use simple bullet points.',
      personal: 'Lives with Aunt May. Working two jobs. Always tired.',
      vip: false, recurrence: 'biweekly',
    },
  },
  {
    first_name: 'Ellen', last_name: 'Ripley',
    phone: '6475550004', email: 'ellen.r@example.com',
    street: '57 Nostromo Way', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['One-time'],
    notes: 'Post-renovation declutter. Organize the garage storage bins.',
    ai_context: {
      prefs: 'Labels required for all bins. Use clear plastic containers.',
      access: 'Keycard in the lockbox (code 1234).',
      comms: 'Direct and to the point. No small talk.',
      personal: 'Has a ginger cat named Jonesy. Surviving a lot of stress.',
      vip: false, recurrence: null,
    },
  },
  {
    first_name: 'Diana', last_name: 'Prince',
    phone: '6475550005', email: 'diana.p@example.com',
    street: '123 Amazonia Way', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['VIP', 'Monthly'],
    notes: 'Very organized. Needs help with artifact dusting.',
    ai_context: {
      prefs: 'Handle artifacts with white gloves. Only natural light for cleaning.',
      access: 'Fingerprint scanner or key with the neighbor.',
      comms: 'Prefers voice notes. Very polite.',
      personal: 'Works at the museum. Loves history and Greek culture.',
      vip: true, recurrence: 'monthly',
    },
  },
  {
    first_name: 'Clark', last_name: 'Kent',
    phone: '6475550006', email: 'clark.k@example.com',
    street: '344 Clinton St', city: 'Georgetown', province: 'ON',
    status: 'active', tags: ['Weekly'],
    notes: 'Quiet apartment. Focus on the desk and window areas.',
    ai_context: {
      prefs: 'Don\'t touch the typewriter. Likes it smells like rain.',
      access: 'Key under the mat. Door is usually unlocked.',
      comms: 'E-mail for long updates, otherwise texts.',
      personal: 'Reporter for the Daily Planet. Very mild-mannered.',
      vip: false, recurrence: 'weekly',
    },
  }
];

async function seedClients(businessId) {
  const toInsert = CLIENTS.map(c => ({ ...c, business_id: businessId }));
  const { data, error } = await sb.from('clients').insert(toInsert).select();
  if (error) die('cli', error);
  log('cli', `inserted ${data.length} realistic clients`);
  return Object.fromEntries(data.map(c => [c.email, c.id]));
}

async function getServiceMap(businessId) {
  const { data, error } = await sb.from('services').select('id, name').eq('business_id', businessId);
  if (error) die('svc', error);
  return Object.fromEntries(data.map(s => [s.name, s.id]));
}

const TODAY = new Date('2026-04-26T12:00:00');
const fmtDate = (d) => d.toISOString().split('T')[0];

const JOBS = [
  // PAST - COMPLETED & PAID (With Duration)
  { email: 'sarah.c@example.com', svc: 'Regular',    days: -14, time: '09:00', status: 'Completed', pay: 'Paid', duration: 2.5, notes: 'Great job.' },
  { email: 'sarah.c@example.com', svc: 'Regular',    days: -7, time: '09:00', status: 'Completed', pay: 'Paid', duration: 2.25, notes: 'Great job as usual.' },
  { email: 'peter.p@example.com', svc: 'Quick Tidy', days: -4, time: '14:00', status: 'Completed', pay: 'Paid', duration: 1.0, notes: 'Helped him find his camera.' },
  { email: 'clark.k@example.com', svc: 'Regular',    days: -2, time: '10:00', status: 'Completed', pay: 'Paid', duration: 2.0, notes: 'Cleaned the typewriter.' },
  
  // PAST - COMPLETED & UNPAID (Needs Manual Hours)
  { email: 'ellen.r@example.com', svc: 'Deep Clean', days: -3, time: '10:00', status: 'Completed', pay: '', duration: null, notes: 'Basement was... intense.' },
  { email: 'diana.p@example.com', svc: 'Deep Clean', days: -10, time: '08:00', status: 'Completed', pay: '', duration: null, notes: 'Dusting artifacts took time.' },
  
  // TODAY - SCHEDULED
  { email: 'sarah.c@example.com', svc: 'Regular',    days: 0,  time: '09:00', status: 'Scheduled', pay: '', notes: 'Check the robot vacuum filters.' },
  { email: 'peter.p@example.com', svc: 'Quick Tidy', days: 0,  time: '13:00', status: 'Scheduled', pay: '', notes: 'Laundry day.' },
  { email: 'clark.k@example.com', svc: 'Regular',    days: 0,  time: '16:00', status: 'Scheduled', pay: '', notes: 'Tidy up the desk.' },
  
  // FUTURE - SCHEDULED
  { email: 'bruce.w@example.com', svc: 'Deep Clean', days: 2,  time: '08:00', status: 'Scheduled', pay: '', notes: 'Alfred mentioned a "bat-related" mess in the cave entrance.' },
  { email: 'sarah.c@example.com', svc: 'Regular',    days: 7,  time: '09:00', status: 'Scheduled', pay: '', notes: 'Weekly maintenance.' },
  { email: 'diana.p@example.com', svc: 'Regular',    days: 15, time: '11:00', status: 'Scheduled', pay: '', notes: 'Monthly artifact check.' },
  
  // CANCELLED
  { email: 'peter.p@example.com', svc: 'Regular',    days: -10, time: '11:00', status: 'Cancelled', pay: '', notes: 'Last minute emergency in Queens.' }
];

async function seedJobs(businessId, clientMap, serviceMap) {
  const rows = JOBS.map(j => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + j.days);
    const dateStr = fmtDate(d);
    
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
      total_amount: j.svc === 'Deep Clean' ? 185 : j.svc === 'Quick Tidy' ? 85 : 120,
      actual_duration: j.duration || null,
      estimated_hours: j.svc === 'Deep Clean' ? 4 : j.svc === 'Quick Tidy' ? 1 : 2,
      scheduling_type: 'Hard Date',
      pricing_type: 'Flat'
    };
  });

  const { data, error } = await sb.from('jobs').insert(rows).select();
  if (error) die('job', error);
  log('job', `inserted ${data.length} realistic jobs across past/present/future`);
}

// RUN
const biz = await getBusiness();
const clientMap = await seedClients(biz.id);
const serviceMap = await getServiceMap(biz.id);
await seedJobs(biz.id, clientMap, serviceMap);

console.log('\n✅ Realistic data seed complete!');
