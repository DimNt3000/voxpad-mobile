/**
 * Parity checks for the two language tables. A key present in one language but
 * not the other surfaces in the app as raw key text rather than as an error,
 * so it needs a test to catch it.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LANGUAGES,
  translate,
  sampleText,
  scriptName,
  detectLanguage,
  type UiLanguage,
} from '../src/core/i18n.ts';

const ARGS: Record<string, Record<string, string | number>> = {
  'voice.hint': { script: 'Ελληνικά' },
  'voice.count': { n: 2 },
  'status.ready': { n: 3 },
  'status.speaking': { i: 1, n: 3 },
  'status.paused': { i: 1, n: 3 },
  'meta.counts': { words: 5, duration: '0:07' },
  'error.speech': { error: 'engine failed' },
};

/** Every key the interface asks for. */
const KEYS = [
  'tagline',
  'ui.theme', 'ui.dark', 'ui.light', 'ui.close', 'ui.language',
  'tab.edit', 'tab.read',
  'doc.placeholder',
  'tool.import', 'tool.sample', 'tool.clear', 'tool.clearConfirm',
  'reader.empty', 'reader.hint',
  'voice.heading', 'voice.pick', 'voice.none', 'voice.enhanced',
  'voice.hint', 'voice.useMatch', 'voice.count',
  'delivery.heading', 'delivery.rate', 'delivery.pitch', 'delivery.volume', 'delivery.reset',
  'preset.slow', 'preset.normal', 'preset.brisk',
  'transport.prev', 'transport.play', 'transport.pause', 'transport.resume',
  'transport.stop', 'transport.next', 'transport.seek',
  'status.idle', 'status.empty', 'status.ready', 'status.speaking', 'status.paused', 'status.done',
  'meta.counts', 'meta.empty',
  'privacy.note',
  'error.speech', 'error.fileType', 'error.fileSize', 'error.fileRead',
];

describe('translation tables', () => {
  test('every key resolves in every language', () => {
    const missing: string[] = [];
    for (const lang of LANGUAGES) {
      for (const key of KEYS) {
        const value = translate(lang, key, ARGS[key]);
        if (value === key) missing.push(`${lang}: ${key}`);
        if (typeof value !== 'string' || value.trim() === '') missing.push(`${lang}: ${key} (empty)`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test('the Greek table is really used rather than falling back to English', () => {
    let differing = 0;
    for (const key of KEYS) {
      if (translate('en', key, ARGS[key]) !== translate('el', key, ARGS[key])) differing++;
    }
    assert.ok(differing > KEYS.length * 0.9, `only ${differing} of ${KEYS.length} keys differ`);
  });

  test('an unknown key returns the key rather than throwing', () => {
    assert.equal(translate('en', 'nope.not.a.key'), 'nope.not.a.key');
  });

  test('a corrupt stored language degrades to English instead of throwing', () => {
    // prefs are read from device storage, which can hold anything.
    const bogus = 'zz' as UiLanguage;
    assert.doesNotThrow(() => translate(bogus, 'tab.edit'));
    assert.equal(translate(bogus, 'tab.edit'), translate('en', 'tab.edit'));
  });

  test('plural forms react to the count', () => {
    for (const lang of LANGUAGES) {
      assert.notEqual(translate(lang, 'status.ready', { n: 1 }), translate(lang, 'status.ready', { n: 2 }));
    }
  });
});

describe('sample text', () => {
  test('each language has its own sample, in its own script', () => {
    const en = sampleText('en');
    const el = sampleText('el');
    assert.notEqual(en, el);
    assert.ok(/[Ͱ-Ͽ]/.test(el), 'the Greek sample should contain Greek letters');
    assert.ok(!/[Ͱ-Ͽ]/.test(en), 'the English sample should not');
  });

  test('falls back to English for a corrupt language', () => {
    assert.equal(sampleText('zz' as UiLanguage), sampleText('en'));
  });

  test('samples contain several sentences', () => {
    for (const lang of LANGUAGES) {
      assert.ok(sampleText(lang).split(/[.!?]/).length > 3, `${lang} sample is too short`);
    }
  });
});

describe('scriptName', () => {
  test('translates the script label used in the voice suggestion', () => {
    assert.equal(scriptName('el', 'Greek'), 'Ελληνικά');
    assert.equal(scriptName('en', 'Greek'), 'Greek');
  });

  test('passes an unknown script through unchanged', () => {
    assert.equal(scriptName('en', 'Klingon'), 'Klingon');
  });
});

describe('detectLanguage', () => {
  test('returns a supported language', () => {
    assert.ok(LANGUAGES.includes(detectLanguage()));
  });

  test('never throws, whatever the platform reports', () => {
    assert.doesNotThrow(() => detectLanguage());
  });
});
