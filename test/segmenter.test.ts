/**
 * The segmenter is shared logic ported from the web app, so these tests double
 * as a guard against the two copies drifting apart. Hermes has no
 * Intl.Segmenter, which makes the hand written scanner the path that actually
 * runs on device: it is exercised first here for that reason.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  segment,
  wordAt,
  countWords,
  estimateSeconds,
  formatDuration,
  detectScript,
} from '../src/core/segmenter.ts';

const NL = '\n';
const texts = (chunks: { text: string }[]) => chunks.map((c) => c.text);

/** Runs `fn` with Intl.Segmenter removed, which is what Hermes gives us. */
function asHermes(fn: () => void) {
  const intl = Intl as unknown as { Segmenter?: unknown };
  const original = intl.Segmenter;
  delete intl.Segmenter;
  try {
    fn();
  } finally {
    intl.Segmenter = original;
  }
}

/** Both paths must satisfy the same contract. */
function bothPaths(name: string, fn: () => void) {
  test(`${name} (scanner path, the one Hermes takes)`, () => asHermes(fn));
  test(`${name} (Intl path, used on the web target)`, () => fn());
}

describe('segment', () => {
  bothPaths('splits on sentence punctuation', () => {
    assert.deepEqual(texts(segment('One. Two! Three?')), ['One.', 'Two!', 'Three?']);
  });

  bothPaths('treats the Greek question mark and ano teleia as terminators', () => {
    // U+037E was silently lost in this port once, by an editor normalising it
    // to an ASCII semicolon. If that happens again, this fails.
    assert.equal(segment('Ερώτηση; Ναί· Τέλος.').length, 3);
  });

  bothPaths('treats the ASCII semicolon as a terminator, as Greek typing produces it', () => {
    assert.equal(segment('Ερώτηση; Απάντηση.').length, 2);
  });

  test('ignores a semicolon with no space after it (scanner path, what runs on device)', () => {
    // Only asserted on the scanner. The Intl path defers to the platform's
    // sentence rules, and those differ between engines: Chromium breaks at
    // every semicolon, Node's ICU at none.
    asHermes(() => {
      assert.deepEqual(texts(segment('const a={x:1;y:2}; done.')), ['const a={x:1;y:2};', 'done.']);
      assert.deepEqual(texts(segment('See https://a.com/x;y;z now.')), ['See https://a.com/x;y;z now.']);
    });
  });

  bothPaths('returns offsets that map back onto the source exactly', () => {
    const text = 'Πρώτη πρόταση.  Δεύτερη!\n\nΤρίτη εδώ;';
    for (const chunk of segment(text)) {
      assert.equal(text.slice(chunk.start, chunk.end), chunk.text);
    }
  });

  bothPaths('never emits a chunk containing a hard line break', () => {
    // The reader groups chunks into paragraphs by looking at the gaps between
    // them, so a newline inside a chunk would merge two paragraphs.
    for (const text of [
      `He waved${NL}"Hello there!"`,
      `Line one${NL})closer first`,
      `Ends here.${NL}${NL}New paragraph.`,
    ]) {
      for (const chunk of segment(text)) {
        assert.ok(!chunk.text.includes(NL), `chunk crossed a newline in ${JSON.stringify(text)}`);
      }
    }
  });

  bothPaths('does not steal the opening quote of the next line', () => {
    assert.deepEqual(texts(segment(`He waved${NL}"Hello there!"`)), ['He waved', '"Hello there!"']);
  });

  bothPaths('keeps a closing quote that belongs to the same line', () => {
    assert.deepEqual(texts(segment('Είπε: "Ναι!" Μετά έφυγε.')), ['Είπε: "Ναι!"', 'Μετά έφυγε.']);
  });

  bothPaths('drops whitespace-only input', () => {
    assert.deepEqual(segment(''), []);
    assert.deepEqual(segment('   \n\t '), []);
  });

  bothPaths('respects the maximum chunk length', () => {
    const long = 'Μια πολύ μεγάλη πρόταση με αρκετές λέξεις που ξεπερνά σίγουρα το όριο.';
    for (const chunk of segment(long, 30)) {
      assert.ok(chunk.text.length <= 30);
    }
  });

  bothPaths('hard splits a token longer than the limit without losing characters', () => {
    const token = 'x'.repeat(120);
    const chunks = segment(`Before ${token} after.`, 50);
    const recovered = chunks.map((c) => c.text).join('').replace(/[^x]/g, '');
    assert.equal(recovered.length, token.length);
    for (const chunk of chunks) assert.ok(chunk.text.length <= 50);
  });

  bothPaths('keeps surrogate pairs intact', () => {
    for (const chunk of segment('Hello 👋 world 🌍! Δεύτερη 🚀 πρόταση.')) {
      assert.equal([...chunk.text].join(''), chunk.text);
    }
  });
});

describe('wordAt', () => {
  test('returns the word starting at the index', () => {
    assert.deepEqual(wordAt('alpha beta gamma', 6), { start: 6, length: 4 });
  });

  test('skips forward from whitespace', () => {
    assert.deepEqual(wordAt('alpha  beta', 5), { start: 7, length: 4 });
  });

  test('returns null past the end', () => {
    assert.equal(wordAt('alpha ', 5), null);
    assert.equal(wordAt('', 0), null);
  });
});

describe('counting and formatting', () => {
  test('countWords ignores surrounding and repeated whitespace', () => {
    assert.equal(countWords('  ένα δύο   τρία  '), 3);
    assert.equal(countWords('   '), 0);
  });

  test('estimateSeconds scales inversely with rate', () => {
    assert.equal(estimateSeconds(170, 1), 60);
    assert.equal(estimateSeconds(170, 2), 30);
    assert.equal(estimateSeconds(0, 1), 0);
  });

  test('estimateSeconds survives a zero rate', () => {
    assert.ok(Number.isFinite(estimateSeconds(100, 0)));
  });

  test('formatDuration pads and adds hours only when needed', () => {
    assert.equal(formatDuration(9), '0:09');
    assert.equal(formatDuration(75), '1:15');
    assert.equal(formatDuration(3725), '1:02:05');
    assert.equal(formatDuration(-5), '0:00');
  });
});

describe('detectScript', () => {
  test('detects Greek, which drives the matching voice suggestion', () => {
    assert.deepEqual(detectScript('Καλημέρα κόσμε'), { script: 'Greek', lang: 'el' });
  });

  test('detects Cyrillic', () => {
    assert.deepEqual(detectScript('Доброе утро мир'), { script: 'Cyrillic', lang: 'ru' });
  });

  test('reports null for Latin and for mixed text Latin dominates', () => {
    assert.equal(detectScript('Good morning world'), null);
    assert.equal(detectScript('Mostly English with ένα ελληνικό'), null);
    assert.equal(detectScript(''), null);
  });
});
