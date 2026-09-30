import { GoogleGenAI } from '@google/genai';

// Single source of truth for the Gemini model id — mirrors the old
// HAIKU_MODEL pattern in api/ai/[action].js (retired-model incident,
// 2026-09-15). One place to fix on the next model swap.
// gemini-2.5-flash 404s on new API keys as of 2026-09-22 ("no longer
// available to new users") — Google's replacement is gemini-3.6-flash.
export const GEMINI_MODEL = 'gemini-3.6-flash';

// gemini-3.6-flash defaults to an internal "thinking" pass that consumes
// maxOutputTokens on reasoning tokens before any visible text is written —
// with the short budgets these JSON-summary prompts use (150-300 tokens),
// thinking alone can exhaust the budget and return empty content. Disabled
// to match the old Haiku model's behavior (no hidden reasoning overhead).
const NO_THINKING = { thinkingConfig: { thinkingBudget: 0 } };

export function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

// 429 (quota/rate limit) and 503 (overloaded) are usually transient — the
// error log showed repeated gemini-3.6-flash 429s on client-brief generation
// that a short backoff would have ridden out. Kept to 2 retries / ~2s total so
// a genuinely exhausted daily quota still fails fast inside the serverless
// function's time budget instead of hanging.
const RETRY_DELAYS_MS = [600, 1400];

export function isRetryableGeminiError(err) {
  const status = err?.status ?? err?.code;
  if (status === 429 || status === 503) return true;
  return /(429|503)|RESOURCE_EXHAUSTED|UNAVAILABLE/.test(String(err?.message || ''));
}

export async function generateContentWithRetry(gemini, params, delaysMs = RETRY_DELAYS_MS) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await gemini.models.generateContent(params);
    } catch (err) {
      if (attempt >= delaysMs.length || !isRetryableGeminiError(err)) throw err;
      console.warn(`[gemini] retryable error (attempt ${attempt + 1}/${delaysMs.length + 1}): ${err.message}`);
      await new Promise(r => setTimeout(r, delaysMs[attempt]));
    }
  }
}

export async function generateText(gemini, prompt, maxOutputTokens) {
  const response = await generateContentWithRetry(gemini, {
    model: GEMINI_MODEL,
    contents: prompt,
    config: { maxOutputTokens, ...NO_THINKING },
  });
  return response.text;
}
