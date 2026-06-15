import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { jobId, action = 'upsert' } = req.body;

  try {
    // 1. Fetch Job
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*, clients(*)')
      .eq('id', jobId)
      .single();
    if (jobErr || !job) throw new Error('Job not found');

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
      const eventId = job.ai_context?.gcal_event_id;
      if (eventId) {
        await calendar.events.delete({ calendarId: integration.calendar_id, eventId });
        await supabase.from('jobs').update({ 
          ai_context: { ...job.ai_context, gcal_sync_status: 'deleted' } 
        }).eq('id', jobId);
      }
      return res.status(200).json({ status: 'deleted' });
    }

    // 4. Map Job to GCal Event
    const clientName = [job.clients.first_name, job.clients.last_name].filter(Boolean).join(' ');
    const summary = `${job.service_name} - ${clientName}`;

    const descLines = [];
    if (job.service_name) descLines.push(`Service: ${job.service_name}`);
    if (clientName)       descLines.push(`Client: ${clientName}`);
    if (job.clients.phone) descLines.push(`Phone: ${job.clients.phone}`);
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
      } catch (updateErr) {
        // If event not found, try inserting instead
        if (updateErr.code === 404) {
          result = await calendar.events.insert({
            calendarId: integration.calendar_id,
            resource: event,
          });
          gcalEventId = result.data.id;
        } else {
          throw updateErr;
        }
      }
    } else {
      result = await calendar.events.insert({
        calendarId: integration.calendar_id,
        resource: event,
      });
      gcalEventId = result.data.id;
    }

    // 5. Update Job with event ID
    await supabase.from('jobs').update({
      ai_context: {
        ...(job.ai_context || {}),
        gcal_event_id: gcalEventId,
        gcal_sync_status: 'synced',
        gcal_last_sync: new Date().toISOString()
      }
    }).eq('id', jobId);

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
