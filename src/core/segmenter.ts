/**
 * Splits raw text into speakable chunks.
 *
 * Same design as the web version of Voxpad, for the same reasons:
 *
 *  1. Native TTS engines cap utterance length (`Speech.maxSpeechInputLength`
 *     on Android is a few thousand characters, and long utterances cannot be
 *     interrupted per sentence anyway).
 *  2. Sentence sized chunks give the app a cursor. The engine always knows
 *     which sentence is playing, which is what makes highlighting, seeking and
 *     "next sentence" possible even when the platform never fires word
 *     boundary events.
 *
 * One mobile specific difference: Hermes, the JS engine React Native ships,
 * does not implement `Intl.Segmenter`, so the hand written scanner below is
 * not a legacy fallback here, it is the primary path. The `Intl` branch stays
 * for the web target and for future Hermes versions.
 */

export interface Chunk {
  start: number;
  end: number;
  text: string;
}

const DEFAULT_MAX = 180;

/** Characters that can close a sentence. The escapes are the Greek question
 *  mark (U+037E) and ano teleia (U+0387), kept as escapes on purpose: an editor
 *  normalizing them to lookalikes silently changes behavior, which is exactly
 *  how the mobile port once lost U+037E. */
const TERMINATORS = new Set(['.', '!', '?', '…', ';', '\u037e', '·', '\u0387', '\n']);
const CLOSERS = new Set(['"', "'", '”', '’', ')', ']', '»']);

type SegmenterCtor = new (
  locale: string | undefined,
  options: { granularity: 'sentence' }
) => { segment(text: string): Iterable<{ segment: string; index: number }> };

function intlSegmenter(): SegmenterCtor | null {
  const intl = globalThis.Intl as unknown as { Segmenter?: SegmenterCtor } | undefined;
  return intl && typeof intl.Segmenter === 'function' ? intl.Segmenter : null;
}

export function segment(text: string, maxLen: number = DEFAULT_MAX): Chunk[] {
  if (!text || !text.trim()) return [];

  const Segmenter = intlSegmenter();
  const sentences = Segmenter ? intlSentences(text, Segmenter) : scanSentences(text);
  const chunks: Chunk[] = [];

  for (const s of sentences) {
    if (s.end - s.start <= maxLen) chunks.push(s);
    else splitLong(text, s, maxLen, chunks);
  }
  return chunks;
}

/* ------------------------------------------------------------------ split -- */

function intlSentences(text: string, Segmenter: SegmenterCtor): Chunk[] {
  const out: Chunk[] = [];
  const segmenter = new Segmenter(undefined, { granularity: 'sentence' });
  for (const part of segmenter.segment(text)) {
    // Intl keeps hard line breaks inside a segment. Break on them too, so that
    // lists and verse do not turn into one long run-on utterance.
    let from = part.index;
    const body = part.segment;
    for (let i = 0; i < body.length; i++) {
      if (body[i] !== '\n') continue;
      addSpan(out, text, from, part.index + i);
      from = part.index + i + 1;
    }
    addSpan(out, text, from, part.index + body.length);
  }
  return out;
}

/** The primary path under Hermes, which has no Intl.Segmenter. */
function scanSentences(text: string): Chunk[] {
  const out: Chunk[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (!TERMINATORS.has(text[i])) continue;

    let end = i + 1;
    // A line break ends the run immediately: closers on the NEXT line belong
    // to the next sentence, and a chunk must never span a hard line break
    // (the reader's paragraph grouping depends on that invariant).
    if (text[i] !== '\n') {
      while (end < text.length && (TERMINATORS.has(text[end]) || CLOSERS.has(text[end]))) {
        if (text[end] === '\n') { end++; break; }
        end++;
      }
    }

    const next = text[end];
    if (next === undefined || /\s/.test(next) || text[i] === '\n') {
      addSpan(out, text, start, end);
      start = end;
      i = end - 1;
    }
  }
  addSpan(out, text, start, text.length);
  return out;
}

/** Breaks an oversized sentence on word boundaries. */
function splitLong(text: string, span: Chunk, maxLen: number, out: Chunk[]): void {
  const words: Array<[number, number]> = [];
  const slice = text.slice(span.start, span.end);
  const re = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(slice)) !== null) {
    let wordStart = span.start + match.index;
    const wordEnd = wordStart + match[0].length;
    // A single token longer than the limit (a URL, a hash) gets hard split.
    while (wordEnd - wordStart > maxLen) {
      words.push([wordStart, wordStart + maxLen]);
      wordStart += maxLen;
    }
    words.push([wordStart, wordEnd]);
  }

  let from: number | null = null;
  let to = 0;
  for (const [wordStart, wordEnd] of words) {
    if (from === null) {
      from = wordStart;
      to = wordEnd;
    } else if (wordEnd - from <= maxLen) {
      to = wordEnd;
    } else {
      addSpan(out, text, from, to);
      from = wordStart;
      to = wordEnd;
    }
  }
  if (from !== null) addSpan(out, text, from, to);
}

/** Trims the edges of a span and drops it if nothing is left. */
function addSpan(out: Chunk[], text: string, start: number, end: number): void {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (end > start) out.push({ start, end, text: text.slice(start, end) });
}

/* ------------------------------------------------------------- utilities -- */

/** Word boundary containing or following `index`, for engines that report a
 *  boundary position without a length. */
export function wordAt(text: string, index: number): { start: number; length: number } | null {
  let start = Math.max(0, Math.min(index, text.length - 1));
  while (start < text.length && /\s/.test(text[start])) start++;
  if (start >= text.length) return null;

  let end = start;
  while (end < text.length && !/\s/.test(text[end])) end++;
  return { start, length: end - start };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Rough listening time. 170 words per minute is a common speaking pace. */
export function estimateSeconds(wordCount: number, rate = 1): number {
  if (!wordCount) return 0;
  return Math.round((wordCount / (170 * (rate || 1))) * 60);
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Detects the writing system so the app can suggest a matching voice. Latin
 * script is deliberately reported as null: it covers too many languages to
 * guess from characters alone.
 */
export function detectScript(text: string): { script: string; lang: string } | null {
  const sample = text.slice(0, 4000);
  const counts: Record<string, number> = {
    el: (sample.match(/[Ͱ-Ͽἀ-῿]/g) || []).length,
    ru: (sample.match(/[Ѐ-ӿ]/g) || []).length,
    ar: (sample.match(/[؀-ۿ]/g) || []).length,
    he: (sample.match(/[֐-׿]/g) || []).length,
    latin: (sample.match(/[a-zÀ-ɏ]/gi) || []).length,
  };

  const scripts: Record<string, string> = { el: 'Greek', ru: 'Cyrillic', ar: 'Arabic', he: 'Hebrew' };
  let best: string | null = null;
  for (const key of Object.keys(scripts)) {
    if (counts[key] > counts.latin && counts[key] > (best ? counts[best] : 8)) best = key;
  }
  return best ? { script: scripts[best], lang: best } : null;
}
