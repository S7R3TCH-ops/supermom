// Pure logic for the agentic AI summaries feature (client brief + day brief) —
// input hashing and prompt assembly. Deliberately has ZERO imports from
// @anthropic-ai/sdk or @supabase/* (those live only in api/ai/[action].js) so
// every function here is a plain (input) -> output transform, testable
// without mocking a network client or hitting the DB — mirrors the
// api/_lib/pushAlerts.js precedent (see briefs.test.js).
//
// Design doc: second-brain/00-inbox/2026-09-18-supermom-agentic-ai-summary-design.md
// §3.2 (client-brief), §3.3 (day-brief), §3.5/§3.7 (fingerprint + handler shape).

import { createHash } from 'node:crypto';

// Bump this to deliberately invalidate every cached ai_briefs row (e.g. a
// prompt-wording rewrite) without the assembled *inputs* themselves changing.
export const PROMPT_VERSION = 1;

function truncate(s, max) {
  const str = String(s ?? '').trim();
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1).trimEnd()}…`;
}

// ── hashing ──────────────────────────────────────────────────────────────

/**
 * Recursively sorts object keys so JSON.stringify is stable regardless of the
 * order the caller assembled the object in. Arrays keep their element order
 * (order is semantically meaningful for e.g. a job list) — only plain-object
 * keys are sorted.
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortKeysDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
}

/**
 * sha256(JSON.stringify(inputs, sortedKeys)) over the assembled input
 * payload, with PROMPT_VERSION folded in so a deliberate prompt-wording
 * change can invalidate every cached row by bumping the constant. Key order
 * inside `inputs` never affects the result; array order does.
 */
export function hashInputs(inputs) {
  const payload = JSON.stringify({ v: PROMPT_VERSION, inputs: sortKeysDeep(inputs ?? {}) });
  return createHash('sha256').update(payload).digest('hex');
}

// ── client-brief (§3.2) ─────────────────────────────────────────────────────

/**
 * Deterministic fallback for a client with zero completed jobs — never call
 * Anthropic for this case (no cost for first-visit clients). "Intel notes"
 * (clients.notes) are folded into watch_for when present.
 */
function buildFirstVisitBrief(clientNotes) {
  const watch_for = [];
  const notes = (clientNotes ?? '').trim();
  if (notes) watch_for.push(truncate(notes, 120));
  return { brief: 'First visit — no history yet.', watch_for };
}

/**
 * inputs shape:
 * {
 *   ownerName, clientName, style,
 *   history: [{ date, service_name, job_notes, completion_notes }], // last 5 completed jobs, newest first
 *   clientNotes,           // clients.notes (Intel)
 *   access, prefs, personal, // ai_context.{access,prefs,personal}
 *   tags: [],
 *   pendingNote,           // unconsumed clients.pending_note, or ''
 *   learned: { synthesis_note, behavioral_flags, preferred_time_of_day },
 * }
 *
 * Returns either:
 *   { skip: true, result: { brief, watch_for } }          — zero history, no Anthropic call needed
 *   { skip: false, prompt: string, maxTokens: number }    — real call
 */
export function buildClientBriefPrompt(inputs) {
  const {
    ownerName = 'the business owner',
    clientName = 'this client',
    style = 'professional',
    history = [],
    clientNotes = '',
    access = '',
    prefs = '',
    personal = '',
    tags = [],
    pendingNote = '',
    learned = {},
  } = inputs || {};

  if (!history.length) {
    return { skip: true, result: buildFirstVisitBrief(clientNotes) };
  }

  const historyText = history.map(h => {
    const parts = [];
    if (h.job_notes) parts.push(`pre: ${h.job_notes}`);
    if (h.completion_notes) parts.push(`post: ${h.completion_notes}`);
    const notesText = parts.length ? ` (${parts.join(' | ')})` : '';
    return `- ${h.date}: ${h.service_name || 'service'}${notesText}`;
  }).join('\n');

  const contextLines = [];
  if (clientNotes) contextLines.push(`Intel notes: ${clientNotes}`);
  if (access) contextLines.push(`Access: ${access}`);
  if (prefs) contextLines.push(`Preferences: ${prefs}`);
  if (personal) contextLines.push(`Personal: ${personal}`);
  if (tags.length) contextLines.push(`Tags: ${tags.join(', ')}`);
  if (pendingNote) contextLines.push(`Carried note (not yet used on a visit): ${pendingNote}`);

  const learnedLines = [];
  if (learned.synthesis_note) learnedLines.push(`Pattern summary: ${learned.synthesis_note}`);
  if (learned.behavioral_flags?.length) learnedLines.push(`Flags: ${learned.behavioral_flags.join(', ')}`);
  if (learned.preferred_time_of_day) learnedLines.push(`Prefers ${learned.preferred_time_of_day} appointments.`);

  const prompt = `You are an AI assistant for ${ownerName}, a busy solo home-services business owner, preparing a short briefing about ${clientName} before an upcoming visit.

You ONLY summarize the history and context given below. Never paraphrase a specific instruction into something different, and never invent or assume anything that isn't stated — if something is unclear, leave it out rather than guessing.

Client context:
${contextLines.length ? contextLines.join('\n') : 'None on file.'}
${learnedLines.length ? `\n${learnedLines.join('\n')}` : ''}

Last ${history.length} completed job${history.length === 1 ? '' : 's'} (most recent first):
${historyText}

Style guidance: use a ${style} tone.

Return ONLY valid JSON (no markdown, no code fences):
{"brief": "2-3 sentences, plain text, no markdown — patterns, preferences, or things to remember from history", "watch_for": ["short item", "..."]}

"watch_for" holds at most 3 short items worth flagging before the visit — use an empty array if there's nothing beyond the brief. Never include a dollar amount or payment status in either field — that's computed separately and shown on its own.`;

  return { skip: false, prompt, maxTokens: 300 };
}

// ── day-brief (§3.3) ────────────────────────────────────────────────────────

function formatJobLines(jobs) {
  if (!jobs || !jobs.length) return 'None.';
  return jobs.map(j => {
    const bits = [];
    bits.push(`${j.time || 'no time set'} — ${j.client_name || 'client'}${j.is_first_visit ? ' (first visit)' : ''}`);
    if (j.service_name) bits.push(j.service_name);
    if (typeof j.drive_minutes === 'number') bits.push(`${j.drive_minutes} min drive`);
    if (j.job_notes) bits.push(`open note: ${j.job_notes}`);
    if (j.pending_note) bits.push(`carried note: ${j.pending_note}`);
    if (typeof j.unpaid_amount === 'number' && j.unpaid_amount > 0) {
      bits.push(`owes $${j.unpaid_amount.toFixed(2)}${j.unpaid_since ? ` from ${j.unpaid_since}` : ''}`);
    }
    if (j.behavioral_flags?.length) bits.push(`flags: ${j.behavioral_flags.join(', ')}`);
    if (j.tags?.length) bits.push(`tags: ${j.tags.join(', ')}`);
    return `- [${j.job_id}] ${bits.join(' · ')}`;
  }).join('\n');
}

function formatAttentionLines(items) {
  if (!items || !items.length) return 'None.';
  return items.map(i => `- [${i.job_id}] ${i.client_name || 'client'}: ${i.why}`).join('\n');
}

/**
 * inputs shape:
 * {
 *   ownerName, style, nowLabel,
 *   todayJobs: [{ job_id, time, client_name, service_name, job_notes, estimated_hours,
 *                 drive_minutes, tags, pending_note, behavioral_flags,
 *                 unpaid_amount, unpaid_since, is_first_visit }],
 *   tomorrowJobs: [ ...same shape... ],
 *   attentionItems: [{ job_id, client_name, why }],
 * }
 *
 * Always returns { prompt, maxTokens } — no skip case (a quiet day still gets
 * a real triage call; there's no zero-cost deterministic day-brief fallback
 * equivalent to the client "first visit" case).
 */
export function buildDayBriefPrompt(inputs) {
  const {
    ownerName = 'the business owner',
    style = 'professional',
    nowLabel = '',
    todayJobs = [],
    tomorrowJobs = [],
    attentionItems = [],
  } = inputs || {};

  const prompt = `You are an AI assistant for ${ownerName}, a busy solo home-services business owner. This is a triage/ranking judgment call, not a plain summary: out of everything listed below, decide what's actually worth her knowing right now and say why — don't just restate the schedule.

Current time: ${nowLabel}.

Today's scheduled jobs:
${formatJobLines(todayJobs)}

Tomorrow's scheduled jobs:
${formatJobLines(tomorrowJobs)}

Already-flagged attention items (past scheduled end and not marked complete, or completed but unpaid):
${formatAttentionLines(attentionItems)}

Style guidance: use a ${style} tone.

Only use what's listed above — never invent an amount, time, or note that isn't there. Return ONLY valid JSON (no markdown, no code fences):
{"summary": "<=160 characters, plain text, one or two short sentences, what she should know right now", "items": [{"job_id": "...", "why": "short reason", "priority": 1}]}

"items" ranks whichever jobs matter most (priority 1 = most important, integers only); return an empty array if nothing stands out beyond the ordinary schedule.`;

  return { prompt, maxTokens: 300 };
}
