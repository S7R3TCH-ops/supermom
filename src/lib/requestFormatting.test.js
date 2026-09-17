import { describe, it, expect } from 'vitest';
import { deriveTitle } from './requestFormatting';

// captureContext() reads window/document/navigator and isn't unit-tested here —
// this project's Vitest environment is 'node' (no jsdom dependency installed),
// consistent with every other test file; it's manually QA'd like the rest of
// the repo layer per CLAUDE.md's testing convention.

describe('deriveTitle', () => {
  it('uses the first line when the body has multiple lines', () => {
    expect(deriveTitle('Invoice total looks wrong\nafter a partial payment')).toBe('Invoice total looks wrong');
  });

  it('uses the whole body when it is a single short line', () => {
    expect(deriveTitle('Add dark mode to the invoice PDF')).toBe('Add dark mode to the invoice PDF');
  });

  it('truncates a long single-line body to 80 chars with an ellipsis', () => {
    const long = 'a'.repeat(120);
    const title = deriveTitle(long);
    expect(title.length).toBe(80);
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back to "Untitled" for empty input', () => {
    expect(deriveTitle('')).toBe('Untitled');
    expect(deriveTitle('   ')).toBe('Untitled');
  });

  it('trims surrounding whitespace', () => {
    expect(deriveTitle('  Something broke  \n\nmore detail')).toBe('Something broke');
  });
});
