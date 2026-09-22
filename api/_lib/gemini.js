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

export async function generateText(gemini, prompt, maxOutputTokens) {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { maxOutputTokens, ...NO_THINKING },
  });
  return response.text;
}
