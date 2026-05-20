import {
  truncateAtWordBoundary,
  buildContext,
  buildNoteName,
  buildNotePath,
} from '../src/note-creator';

describe('truncateAtWordBoundary', () => {
  it('returns string unchanged when under limit', () => {
    expect(truncateAtWordBoundary('hello world', 50)).toBe('hello world');
  });

  it('truncates at the nearest word boundary', () => {
    expect(truncateAtWordBoundary('the quick brown fox jumped over', 15)).toBe('the quick brown');
  });

  it('hard-truncates when no space exists', () => {
    expect(truncateAtWordBoundary('superlongwordwithoutspaces', 10)).toBe('superlongw');
  });

  it('handles exactly maxLen chars', () => {
    expect(truncateAtWordBoundary('hello world', 11)).toBe('hello world');
  });
});

describe('buildContext', () => {
  it('strips special characters', () => {
    expect(buildContext('hello, world! how are you?')).toBe('hello world how are you');
  });

  it('truncates long transcripts to ≤50 chars at a word boundary', () => {
    // "the quarterly review is next week and I want to" = 47 chars
    // "the quarterly review is next week and I want to be" = 50 chars
    const transcript = 'the quarterly review is next week and I want to be there';
    const result = buildContext(transcript);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toBe('the quarterly review is next week and I want to');
  });

  it('handles empty string', () => {
    expect(buildContext('')).toBe('');
  });

  it('collapses multiple spaces', () => {
    expect(buildContext('hello   world')).toBe('hello world');
  });

  it('falls back to truncation when first word is ≥50 chars', () => {
    const longWord = 'a'.repeat(55);
    expect(buildContext(longWord)).toBe('a'.repeat(50));
  });
});

describe('buildNoteName', () => {
  it('formats as YYYY-MM-DD HH-MM-SS__<context>.md', () => {
    const fixed = new Date(2026, 4, 19, 14, 32, 55); // month is 0-indexed
    expect(buildNoteName('hello world', fixed)).toBe('2026-05-19 14-32-55__hello world.md');
  });

  it('zero-pads single-digit month, day, hour, minute, second', () => {
    const fixed = new Date(2026, 0, 5, 9, 5, 3);
    expect(buildNoteName('test', fixed)).toBe('2026-01-05 09-05-03__test.md');
  });

  it('applies buildContext to the transcript', () => {
    const fixed = new Date(2026, 4, 19, 0, 0, 0);
    expect(buildNoteName('hello, world!', fixed)).toBe('2026-05-19 00-00-00__hello world.md');
  });
});

describe('buildNotePath', () => {
  it('returns just filename for root folder /', () => {
    expect(buildNotePath('/', 'note.md')).toBe('note.md');
  });

  it('returns just filename for empty folder', () => {
    expect(buildNotePath('', 'note.md')).toBe('note.md');
  });

  it('prepends folder for non-root folder', () => {
    expect(buildNotePath('notes', 'note.md')).toBe('notes/note.md');
  });

  it('strips leading and trailing slashes from folder', () => {
    expect(buildNotePath('/notes/', 'note.md')).toBe('notes/note.md');
  });
});
