import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { formatPhone } from '../_lib/phone.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Deterministic Google event id for a job: the job's uuid without dashes (32 hex
// chars, valid for Google's a-v/0-9 event-id alphabet). Inserting with it makes
// event creation idempotent: a second, concurrent or later insert for the same job
// gets a 409 instead of creating a second event, and a job whose stored
// gcal_event_id was lost finds its own event again instead of orphaning it.
export const detEventId = (jobId) => String(jobId).replace(/-/g, '').toLowerCase();

const httpStatus = (e) => Number(e?.code) || e?.response?.status || e?.status;
const isGone = (e) => [404, 410].includes(httpStatus(e));

// True when a different live job already points at this Google event. Legacy
// series data had every occurrence sharing one event id; reusing it would keep
// dragging that single event between dates, and deleting it would remove it for
// the whole series.
async function heldByOtherJob(job, eventId) {
  const { data } = await supabase
    .from('jobs')
    .select('id')
    .eq('business_id', job.business_id)
    .is('deleted_at', null)
    .neq('id', job.id)
    .eq('ai_context->>gcal_event_id', eventId)
    .limit(1);
  return (data || []).length > 0;
}

// ai_context is shared with other writers (drive times, clock-in, edits), so merge
// onto a fresh read instead of writing back the snapshot taken at the start of the
// request, which Google round-trips later can leave stale.
async function mergeAiContext(jobId, patch) {
  const { data: fresh, error: readErr } = await supabase.from('jobs').select('ai_context').eq('id', jobId).single();
  // Never write on a failed read: merging onto {} would wipe drive_to, clock_in_time, etc.
  if (readErr || !fresh) throw new Error(`GCal: could not re-read job ${jobId} ai_context: ${readErr?.message || 'not found'}`);
  const { error: writeErr } = await supabase.from('jobs').update({
    ai_context: { ...(fresh.ai_context || {}), ...patch },
  }).eq('id', jobId);
  if (writeErr) throw new Error(`GCal: could not save job ${jobId} ai_context: ${writeErr.message}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { jobId, action = 'upsert' } = req.body;
  let job;

  try {
    // 1. Fetch Job
    const { data, error: jobErr } = await supabase
      .from('jobs')
      .select('*, clients!jobs_client_id_fkey(*)')
      .eq('id', jobId)
      .single();
    if (jobErr || !data) throw new Error('Job not found');
    job = data;

    // 2. Fetch Integration
    const { data: integration, error: intErr } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', job.business_id)
      .eq('service_name', 'google_calendar')
      .maybeSingle();

    if (!integration) return res.status(200).json({ status: 'no_integration' });

    // 3. Setup Google Auth
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: integration.refresh_token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    if (action === 'delete' || job.deleted_at) {
      const storedId = job.ai_context?.gcal_event_id;
      // Never delete an event another live job still points at.
      if (storedId && await heldByOtherJob(job, storedId)) {
        await mergeAiContext(jobId, { gcal_sync_status: 'deleted' });
        return res.status(200).json({ status: 'deleted', shared: true });
      }
      // No stored id (lost, or never saved): fall back to the deterministic id.
      const eventId = storedId || detEventId(jobId);
      try {
        await calendar.events.delete({ calendarId: integration.calendar_id, eventId });
      } catch (delErr) {
        if (!isGone(delErr)) throw delErr;
      }
      await mergeAiContext(jobId, { gcal_sync_status: 'deleted' });
      return res.status(200).json({ status: 'deleted' });
    }

    // 4. Map Job to GCal Event
    const clientName = [job.clients.first_name, job.clients.last_name].filter(Boolean).join(' ');
    const summary = `${job.service_name} - ${clientName}`;

    const descLines = [];
    if (job.service_name) descLines.push(`Service: ${job.service_name}`);
    if (clientName)       descLines.push(`Client: ${clientName}`);
    if (job.clients.phone) descLines.push(`Phone: ${formatPhone(job.clients.phone)}`);
    if (job.clients.email) descLines.push(`Email: ${job.clients.email}`);
    if (job.job_notes)    descLines.push('', job.job_notes);
    descLines.push('', 'Synced from Supermom for Hire');
    const description = descLines.join('\n');

    const timeHHMM = (job.scheduled_time || '09:00').slice(0, 5);
    const startTime = `${job.scheduled_date}T${timeHHMM}:00`;
    const [hh, mm] = timeHHMM.split(':').map(Number);
    const totalMin = hh * 60 + mm + Math.round((job.estimated_hours || 1) * 60);
    const endHH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
    const endMM = String(totalMin % 60).padStart(2, '0');
    const endTime = `${job.scheduled_date}T${endHH}:${endMM}:00`;

    const event = {
      summary,
      location: (() => { const { street, city, province, postal_code } = job.clients; return [street, city, province, postal_code].filter(Boolean).join(', ') || null; })(),
      description,
      colorId: '4', // Flamingo
      status: 'confirmed', // also revives a previously deleted (cancelled) event
      start: { dateTime: startTime, timeZone: 'America/Toronto' },
      end: { dateTime: endTime, timeZone: 'America/Toronto' },
    };

    const calendarId = integration.calendar_id;
    let gcalEventId = job.ai_context?.gcal_event_id || null;

    if (gcalEventId && await heldByOtherJob(job, gcalEventId)) {
      console.warn(`GCal: event ${gcalEventId} is held by another job; giving job ${jobId} its own`);
      gcalEventId = null;
    }

    if (gcalEventId) {
      try {
        await calendar.events.update({ calendarId, eventId: gcalEventId, resource: event });
      } catch (updateErr) {
        if (!isGone(updateErr)) throw updateErr;
        gcalEventId = null; // event is gone on Google's side; recreate below
      }
    }

    if (!gcalEventId) {
      const newId = detEventId(jobId);
      try {
        await calendar.events.insert({ calendarId, resource: { ...event, id: newId } });
      } catch (insertErr) {
        // 409: this job's event already exists (concurrent sync, lost stored id,
        // or deleted earlier). Update it in place rather than creating a second.
        if (httpStatus(insertErr) !== 409) throw insertErr;
        try {
          await calendar.events.update({ calendarId, eventId: newId, resource: event });
        } catch (updErr) {
          // Google refused to revive a deleted event with this id: create a fresh one.
          if (!isGone(updErr)) throw updErr;
          const created = await calendar.events.insert({ calendarId, resource: event });
          gcalEventId = created.data.id;
        }
      }
      gcalEventId = gcalEventId || newId;
    }

    // 5. Update Job with event id
    await mergeAiContext(jobId, {
      gcal_event_id: gcalEventId,
      gcal_sync_status: 'synced',
      gcal_last_sync: new Date().toISOString(),
    });

    res.status(200).json({ status: 'synced', eventId: gcalEventId });
  } catch (err) {
    // Detect expired/revoked refresh token (Google returns invalid_grant)
    const isTokenExpired =
      err.response?.data?.error === 'invalid_grant' ||
      err.message?.includes('invalid_grant');

    if (isTokenExpired) {
      try {
        await supabase.from('integrations')
          .update({ sync_status: 'token_expired' })
          .eq('business_id', job?.business_id)
          .eq('service_name', 'google_calendar');
      } catch (dbErr) {
        console.error('GCal: failed to write token_expired status:', dbErr);
      }
      return res.status(200).json({ status: 'token_expired' });
    }

    console.error('GCal Sync Error:', err);
    res.status(500).json({ error: err.message });
  }
}
