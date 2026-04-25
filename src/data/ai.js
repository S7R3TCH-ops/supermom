// Local AI logic for generating briefings and smart suggestions.

/**
 * Generates a structured "Command Brief" for a job.
 * Returns an object with headline, bullets, and speechText.
 */
export function generateCommandBrief(job, businessProfile = null) {
  if (!job) return null;

  const ai = job.ai_context || {}; 
  const clientAi = job.client_ai_context || {};
  const notes = job.client_notes || '';
  const tags = job.client_tags || [];
  const clientName = job.client_name?.split(' ')[0] || 'Client';

  const style = businessProfile?.ai_profile?.style || 'professional';

  const bullets = [];
  let speechText = '';

  // Stylistic openers
  if (style === 'coach') {
    speechText = `You've got this! Next up is a visit with ${clientName}. `;
  } else if (style === 'casual') {
    speechText = `Alright, heading over to ${clientName} next. `;
  } else {
    speechText = `Next up is ${clientName}. `;
  }

  // 1. High-priority flags
  const isVip = tags.some(t => t.toLowerCase().includes('vip'));
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

  const personal = clientAi.personal || '';
  if (personal) {
    bullets.push({ icon: '👤', text: personal });
    speechText += `Personal note: ${personal}. `;
  }

  // 4. Job specific notes
  const jobNotes = job.job_notes || '';
  if (jobNotes) {
    bullets.push({ icon: '📌', text: jobNotes });
    speechText += `Specifically for today: ${jobNotes}. `;
  }

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
 * Fetches an AI-generated deep prep note for a client.
 * Calls the backend API which analyzes recent history and notes.
 */
export async function fetchDeepPrepNote(clientId, businessProfile) {
  if (!clientId) throw new Error('clientId is required for fetchDeepPrepNote');

  try {
    const response = await fetch('/api/ai/prep-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId, businessProfile }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch AI prep note (${response.status})`);
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('[fetchDeepPrepNote]', error);
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
 * Calculates a smart duration estimate for Step 2 of the booking flow.
 * Priority: 
 * 1. Last visit duration for this specific service (client-specific)
 * 2. Average duration for this service (client-specific)
 * 3. Default duration for the service type
 */
export function calculateEstimatedDuration(clientRaw, serviceKey, allServices) {
  const service = allServices.find(s => s.key === serviceKey);
  if (!service) return 120;

  // clientRaw.history is likely filtered/decorated, we might want to check the raw jobs
  // but for now let's assume we pass in the history we have.
  // Actually, let's look for jobs in clientRaw.history that match the service label.
  const history = clientRaw?.history || [];
  const matchingJobs = history.filter(h => h.service === service.label);

  if (matchingJobs.length > 0) {
    // Return the most recent matching job's duration
    // history is already sorted desc by date in toDisplayClient
    const lastJob = matchingJobs[0];
    
    // Parse duration string like "2h 30m" back to minutes
    if (lastJob.duration && lastJob.duration !== '—') {
      const hMatch = lastJob.duration.match(/(\d+)h/);
      const mMatch = lastJob.duration.match(/(\d+)m/);
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      const m = mMatch ? parseInt(mMatch[1], 10) : 0;
      const totalMin = h * 60 + m;
      if (totalMin > 0) return totalMin;
    }
  }

  return service.defaultDuration || 120;
}
