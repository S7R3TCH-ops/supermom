// Local AI logic for generating briefings and smart suggestions.
import { fmtTime12 } from '../lib/dateUtils';
import { authHeaders } from '../lib/supabase';

/**
 * Generates a structured "Command Brief" for a job.
 * Returns an object with headline, bullets, and speechText.
 */
export function generateCommandBrief(job, businessProfile = null, options = {}) {
  if (!job) return null;

  const ai = job.ai_context || {};
  const clientAi = job.client_ai_context || {};
  const notes = job.client_notes || '';
  const tags = Array.isArray(job.client_tags) ? job.client_tags : [];
  const clientName = (typeof job.client_name === 'string' ? job.client_name : '').split(' ')[0] || 'Client';

  const style = businessProfile?.ai_profile?.style || 'professional';
  const { driveText } = options;

  const bullets = [];
  let speechText = '';

  // Stylistic openers
  if (style === 'coach') {
    speechText = `You've got this! Your next session is with ${clientName}. `;
  } else if (style === 'casual') {
    speechText = `Alright, heading over to assist ${clientName} next. `;
  } else {
    speechText = `Next objective: ${clientName}. `;
  }

  // Service + time
  const serviceName = job.service_name || '';
  const startDate = job.start instanceof Date ? job.start
    : (job.scheduled_at ? new Date(job.scheduled_at) : null);
  const endDate = job.end instanceof Date ? job.end
    : (startDate && job.duration_est ? new Date(startDate.getTime() + job.duration_est * 60000) : null);

  if (serviceName || startDate) {
    let timeLine = '';
    if (startDate && !isNaN(startDate.getTime())) {
      const s = fmtTime12(startDate);
      if (endDate && !isNaN(endDate.getTime())) {
        const e = fmtTime12(endDate);
        const rangeStr = s.period === e.period
          ? `${s.time} to ${e.time} ${e.period}`
          : `${s.time} ${s.period} to ${e.time} ${e.period}`;
        timeLine = rangeStr;
      } else {
        timeLine = `${s.time} ${s.period}`;
      }
    }

    if (serviceName && timeLine) {
      bullets.push({ icon: '🗓', text: `${serviceName} · ${timeLine}` });
      speechText += `${serviceName} at ${timeLine}. `;
    } else if (serviceName) {
      bullets.push({ icon: '🗓', text: serviceName });
      speechText += `${serviceName}. `;
    } else if (timeLine) {
      bullets.push({ icon: '🕐', text: timeLine });
      speechText += `Scheduled at ${timeLine}. `;
    }
  }

  // Drive / leave-by
  if (driveText) {
    bullets.push({ icon: '🚗', text: driveText });
    speechText += `About a ${driveText} drive. `;
  }

  // 1. High-priority flags
  const isVip = tags.some(t => typeof t === 'string' && t.toLowerCase().includes('vip'));
  if (isVip) {
    bullets.push({ icon: '🌟', text: 'VIP Client' });
    speechText += style === 'coach' ? `They are one of your amazing VIPs. ` : `They are a VIP client. `;
  }

  // 2. Access & Security
  const access = ai.access || clientAi.access || '';
  if (access) {
    bullets.push({ icon: '🔑', text: access });
    speechText += `Access info: ${access}. `;
  }

  // 3. Pets & Preferences
  const prefs = ai.prefs || clientAi.prefs || '';
  if (prefs) {
    bullets.push({ icon: '✨', text: prefs });
    speechText += `Preference note: ${prefs}. `;
  }

  // Personal notes, learned patterns/behavioral flags, and past completion
  // notes are no longer rendered here as of the agentic-brief rewrite
  // (Stage C, 2026-09-19, second-brain design doc §3.2) — they're now
  // client-brief SUMMARY inputs (see api/ai/[action].js's clientBrief),
  // never displayed raw. generateCommandBrief stays the deterministic
  // FACTS + SPEECH builder only: service/time, drive, VIP, access, prefs.

  // Stylistic closers
  if (style === 'coach') {
    speechText += ` Have a great session!`;
  }

  if (bullets.length === 0 && !notes) return null;

  return {
    headline: `Briefing for ${clientName}`,
    summary: notes || bullets[0]?.text || 'No specific notes.',
    bullets,
    speechText: speechText.trim()
  };
}

/**
 * Fetches the cached/generated client brief — { brief, watch_for } — for the
 * Job Detail card's "Client Brief" block. Replaces fetchDeepPrepNote /
 * PrepNoteSheet (retired, Stage C of the agentic-brief rebuild,
 * second-brain design doc §3.2/§4). The server fingerprint-gates
 * regeneration, so this is safe to call on every sheet open.
 */
export async function fetchClientBrief(clientId, force = false) {
  if (!clientId) throw new Error('clientId is required for fetchClientBrief');

  try {
    const response = await fetch('/api/ai/client-brief', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ clientId, force }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch client brief (${response.status})`);
    }

    const data = await response.json();
    return data.brief; // { brief: string, watch_for: string[] }
  } catch (error) {
    console.error('[fetchClientBrief]', error);
    throw error;
  }
}

/**
 * Uses Web Speech API to read the briefing aloud.
 */
let currentUtterance = null;
export function speakBrief(text, onEnd) {
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  if (!text) return;

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = 0.95; // Slightly slower for clarity
  currentUtterance.pitch = 1.0;
  currentUtterance.onend = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };
  
  window.speechSynthesis.speak(currentUtterance);
}

export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Older simple version for backward compatibility if needed, 
 * but routes to the new structured one's summary.
 */
export function generatePrepNote(job) {
  const brief = generateCommandBrief(job);
  if (!brief) return null;
  return brief.bullets.map(b => `${b.icon} ${b.text}`).join('\n');
}

/**
 * Fetches an AI-generated smart duration estimate for a service.
 */
export async function fetchSmartDurationEstimate(clientId, serviceName, businessProfile) {
  if (!clientId || !serviceName) throw new Error('clientId and serviceName are required');

  try {
    const response = await fetch('/api/ai/estimate-duration', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ clientId, serviceName, businessProfile }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch AI duration estimate (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error('[fetchSmartDurationEstimate]', error);
    throw error;
  }
}

/**
 * Merges two stacked carry-forward client notes into one concise note.
 */
export async function summarizeCarriedNote(clientId, priorNote, newNote) {
  const response = await fetch('/api/ai/summarize-carried-note', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ clientId, priorNote, newNote }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to summarize carried note (${response.status})`);
  }

  const data = await response.json();
  return data.note;
}

/**
 * Calculates a smart duration estimate for Step 2 of the booking flow.
 * Priority:
 * 1. Last visit duration for this specific service (client-specific)
 * 2. Average duration for this service (client-specific)
 * 3. Default duration for the service type
 */
export function calculateEstimatedDuration(clientRaw, serviceName, allServices) {
  const service = allServices.find(s => s.name === serviceName);
  if (!service) return 120;

  const history = clientRaw?.history || [];
  const matchingJobs = history.filter(h => h.service === serviceName);

  if (matchingJobs.length > 0) {
    const lastJob = matchingJobs[0];
    if (lastJob.duration && lastJob.duration !== '—') {
      const hMatch = lastJob.duration.match(/(\d+)h/);
      const mMatch = lastJob.duration.match(/(\d+)m/);
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      const m = mMatch ? parseInt(mMatch[1], 10) : 0;
      const totalMin = h * 60 + m;
      if (totalMin > 0) return totalMin;
    }
  }

  return Number(service.default_duration || service.defaultDuration || 120);
}
