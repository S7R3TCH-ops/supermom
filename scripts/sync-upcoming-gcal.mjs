// One-time script: sync all upcoming scheduled jobs to Google Calendar.
// Run: node scripts/sync-upcoming-gcal.mjs

import 'dotenv/config';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const today = new Date().toISOString().slice(0, 10);

// Fetch all upcoming scheduled jobs (not deleted)
const { data: jobs, error: jobsErr } = await sb
  .from('jobs')
  .select('*, clients(*)')
  .is('deleted_at', null)
  .eq('job_status', 'Scheduled')
  .gte('scheduled_date', today)
  .order('scheduled_date', { ascending: true });

if (jobsErr) { console.error('Failed to fetch jobs:', jobsErr.message); process.exit(1); }
if (!jobs.length) { console.log('No upcoming scheduled jobs found.'); process.exit(0); }

console.log(`Found ${jobs.length} upcoming job(s). Starting GCal sync...\n`);

// Group by business so we only fetch each integration once
const byBusiness = {};
for (const job of jobs) {
  (byBusiness[job.business_id] ||= []).push(job);
}

for (const [businessId, bJobs] of Object.entries(byBusiness)) {
  const { data: integration } = await sb
    .from('integrations')
    .select('*')
    .eq('business_id', businessId)
    .eq('service_name', 'google_calendar')
    .maybeSingle();

  if (!integration) {
    console.log(`  [business ${businessId}] No Google Calendar integration — skipping ${bJobs.length} job(s).`);
    continue;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: integration.refresh_token });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  for (const job of bJobs) {
    const clientName = [job.clients?.first_name, job.clients?.last_name].filter(Boolean).join(' ') || 'Unknown';
    const label = `${job.scheduled_date} ${job.service_name} - ${clientName}`;

    try {
      const rawTime = job.scheduled_time || '09:00';
      const startTime = `${job.scheduled_date}T${rawTime.split(':').length >= 3 ? rawTime : rawTime + ':00'}`;
      const [hh, mm] = rawTime.split(':').map(Number);
      const totalMin = hh * 60 + mm + Math.round((job.estimated_hours || 1) * 60);
      const endHH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
      const endMM = String(totalMin % 60).padStart(2, '0');
      const endTime = `${job.scheduled_date}T${endHH}:${endMM}:00`;

      const event = {
        summary: `${job.service_name} - ${clientName}`,
        location: job.clients?.address || '',
        description: `${job.job_notes || ''}\n\nSynced from Supermom for Hire`.trim(),
        start: { dateTime: startTime, timeZone: 'America/Toronto' },
        end: { dateTime: endTime, timeZone: 'America/Toronto' },
      };

      let gcalEventId = job.ai_context?.gcal_event_id;
      let result;

      if (gcalEventId) {
        try {
          result = await calendar.events.update({
            calendarId: integration.calendar_id,
            eventId: gcalEventId,
            resource: event,
          });
        } catch (e) {
          if (e.code === 404) {
            result = await calendar.events.insert({ calendarId: integration.calendar_id, resource: event });
            gcalEventId = result.data.id;
          } else throw e;
        }
      } else {
        result = await calendar.events.insert({ calendarId: integration.calendar_id, resource: event });
        gcalEventId = result.data.id;
      }

      await sb.from('jobs').update({
        ai_context: {
          ...(job.ai_context || {}),
          gcal_event_id: gcalEventId,
          gcal_sync_status: 'synced',
          gcal_last_sync: new Date().toISOString(),
        }
      }).eq('id', job.id);

      console.log(`  ✓ ${label}`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${err.message}`);
    }
  }
}

console.log('\nDone.');
