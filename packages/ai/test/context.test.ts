import { describe, it, expect } from 'vitest';
import {
  CONTEXT_HEADINGS,
  formatContext,
  keyTerms,
  recencyWeight,
  salience,
  splitSessions,
} from '../src/context.js';
import { RECENT_MARKER, type TranscriptMessage } from '../src/transcript.js';

const NOW = new Date('2026-10-08T12:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const them = (text: string, at: Date): TranscriptMessage => ({ role: 'contact', text, at });
const us = (text: string, at: Date): TranscriptMessage => ({ role: 'agent', text, at });

describe('recencyWeight', () => {
  it('halves every half-life', () => {
    expect(recencyWeight(NOW, NOW)).toBe(1);
    expect(recencyWeight(ago(14 * DAY), NOW)).toBeCloseTo(0.5, 5);
    expect(recencyWeight(ago(28 * DAY), NOW)).toBeCloseTo(0.25, 5);
  });

  it('treats a missing timestamp as current rather than ancient', () => {
    expect(recencyWeight(null, NOW)).toBe(1);
  });
});

describe('splitSessions', () => {
  it('starts a new session after a quiet stretch', () => {
    const s = splitSessions([
      them('a', ago(3 * DAY)),
      us('b', ago(3 * DAY - 5 * MINUTE)),
      them('c', ago(2 * HOUR)),
      us('d', ago(1 * HOUR)),
    ]);
    expect(s.map((x) => x.messages.map((m) => m.text).join(''))).toEqual(['ab', 'cd']);
  });
});

describe('keyTerms / salience', () => {
  it('keeps content words and numbers, drops filler', () => {
    expect(keyTerms('Hey, did the deposit for #4821 go through?')).toEqual([
      'deposit',
      '#4821'.slice(1),
      'through',
    ]);
  });

  it('ranks questions, money and dates above small talk', () => {
    expect(salience('Can you do $450 for the deposit by Friday?')).toBeGreaterThan(
      salience('haha nice'),
    );
  });
});

describe('formatContext', () => {
  it("starts with today's date", () => {
    expect(formatContext([them('hi', ago(MINUTE))], 'Ana', { now: NOW })).toMatch(
      /^Today is Thu, 08 Oct 2026\./,
    );
  });

  it('keeps only the live session verbatim and condenses recent history', () => {
    const out = formatContext(
      [
        them('can we book the venue for $1200 on Saturday?', ago(10 * DAY)),
        us('yes, booked for 6pm', ago(10 * DAY - 10 * MINUTE)),
        them('lol', ago(10 * DAY - 20 * MINUTE)),
        them('running 5 min late', ago(20 * MINUTE)),
        us('no worries', ago(15 * MINUTE)),
      ],
      'Ana',
      { now: NOW },
    );
    const [history, current] = out.split(CONTEXT_HEADINGS.current);
    expect(history).toContain(CONTEXT_HEADINGS.earlier);
    expect(history).toContain('[last week · 3 messages]');
    // The digest keeps the informative lines, not the filler.
    expect(history).toContain('$1200');
    expect(history).not.toContain('lol');
    // Only today's exchange is verbatim.
    expect(current).toContain('Ana: running 5 min late');
    expect(current).not.toContain('venue');
  });

  it('lets old sessions decay out of the context entirely', () => {
    const out = formatContext(
      [
        them('what time is the dentist on the 14th?', ago(200 * DAY)),
        us('3pm', ago(200 * DAY - 5 * MINUTE)),
        them('want to grab lunch?', ago(10 * MINUTE)),
      ],
      'Ana',
      { now: NOW },
    );
    expect(out).not.toContain('dentist');
    expect(out).not.toContain(CONTEXT_HEADINGS.earlier);
  });

  it('recalls an old line when the live exchange points back to it', () => {
    const out = formatContext(
      [
        them('the deposit for the apartment is 1800, due on the 1st', ago(150 * DAY)),
        us('got it', ago(150 * DAY - 5 * MINUTE)),
        them('totally unrelated: nice weather', ago(149 * DAY)),
        them('hey, did you ever send the deposit back?', ago(5 * MINUTE)),
      ],
      'Ana',
      { now: NOW },
    );
    expect(out).toContain(CONTEXT_HEADINGS.recalled);
    expect(out).toMatch(/\[5 months ago\] Ana: the deposit for the apartment is 1800/);
    expect(out).not.toContain('nice weather');
  });

  it('does not recall on filler overlap', () => {
    const out = formatContext(
      [them('thanks so much, really appreciate it', ago(150 * DAY)), them('thanks!', ago(MINUTE))],
      'Ana',
      { now: NOW },
    );
    expect(out).not.toContain(CONTEXT_HEADINGS.recalled);
  });

  it('calls out a long silence and that they may have talked elsewhere', () => {
    const out = formatContext(
      [
        them('see you at the wedding!', ago(120 * DAY)),
        them('long time no see — are you around this weekend?', ago(30 * MINUTE)),
        us('maybe!', ago(20 * MINUTE)),
        them('cool lmk', ago(10 * MINUTE)),
      ],
      'Ana',
      { now: NOW },
    );
    expect(out).toMatch(
      /No messages in this thread for 4 months before this\. They may have been in touch elsewhere/,
    );
  });

  it('treats a short follow-up as part of the session it follows', () => {
    const out = formatContext(
      [
        them('is the blue tote back in stock?', ago(20 * HOUR)),
        us('Monday!', ago(19 * HOUR)),
        them('perfect, hold one for me', ago(5 * MINUTE)),
      ],
      'Ana',
      { now: NOW },
    );
    const current = out.split(CONTEXT_HEADINGS.current)[1]!;
    expect(current).toContain('blue tote');
    expect(current).toContain('hold one for me');
  });

  it('caps the live session and spills its head into the digest', () => {
    const many = Array.from({ length: 55 }, (_, i) => them(`message ${i}`, ago((55 - i) * MINUTE)));
    const out = formatContext(many, 'Ana', { now: NOW, recentCount: 10 });
    const current = out.split(CONTEXT_HEADINGS.current)[1]!;
    expect(current).toContain('message 54');
    expect(current).not.toContain('message 0\n');
    expect(current.split(RECENT_MARKER)[1]!.match(/Ana:/g)).toHaveLength(10);
  });

  it('returns empty for an empty thread', () => {
    expect(formatContext([{ role: 'contact', text: '  ' }], 'Ana', { now: NOW })).toBe('');
  });
});
