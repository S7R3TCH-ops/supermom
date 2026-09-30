import { describe, it, expect, vi } from 'vitest';
import { generateContentWithRetry, isRetryableGeminiError } from './gemini.js';

const fakeGemini = (impl) => ({ models: { generateContent: vi.fn(impl) } });

describe('isRetryableGeminiError', () => {
  it('flags 429/503 by status or message, not other errors', () => {
    expect(isRetryableGeminiError({ status: 429 })).toBe(true);
    expect(isRetryableGeminiError({ status: 503 })).toBe(true);
    expect(isRetryableGeminiError(new Error('RESOURCE_EXHAUSTED: quota'))).toBe(true);
    expect(isRetryableGeminiError({ status: 401, message: 'bad key' })).toBe(false);
    expect(isRetryableGeminiError(new Error('boom'))).toBe(false);
  });
});

describe('generateContentWithRetry', () => {
  it('retries a 429 then succeeds', async () => {
    let n = 0;
    const g = fakeGemini(async () => { if (n++ < 1) throw Object.assign(new Error('429'), { status: 429 }); return { text: 'ok' }; });
    const r = await generateContentWithRetry(g, {}, [1, 1]);
    expect(r.text).toBe('ok');
    expect(g.models.generateContent).toHaveBeenCalledTimes(2);
  });
  it('gives up after the last delay and rethrows', async () => {
    const g = fakeGemini(async () => { throw Object.assign(new Error('429'), { status: 429 }); });
    await expect(generateContentWithRetry(g, {}, [1, 1])).rejects.toThrow('429');
    expect(g.models.generateContent).toHaveBeenCalledTimes(3);
  });
  it('does not retry non-retryable errors', async () => {
    const g = fakeGemini(async () => { throw Object.assign(new Error('bad key'), { status: 401 }); });
    await expect(generateContentWithRetry(g, {}, [1, 1])).rejects.toThrow('bad key');
    expect(g.models.generateContent).toHaveBeenCalledTimes(1);
  });
});
