import { describe, it, expect } from 'vitest';
import { buildRequestEmailHtml } from './brandedEmail.js';

describe('buildRequestEmailHtml logo', () => {
  it('rounds the opaque white logo square into a badge (no white box on the pink header)', () => {
    const html = buildRequestEmailHtml({ kind: 'bug', title: 'T', body: 'B', variant: 'reply' });
    const img = html.match(/<img[^>]*logo-final-white-bg\.png[^>]*>/)?.[0];
    expect(img).toBeTruthy();
    expect(img).toContain('border-radius:50%');
  });
});
