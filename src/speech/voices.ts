/**
 * Voice discovery.
 *
 * On Android, getAvailableVoicesAsync() often returns an empty list until the
 * system TTS engine has finished warming up, so the loader retries on a short
 * backoff instead of trusting the first answer. The same shape of problem
 * exists on the web (getVoices() is empty on first call in Chromium), which is
 * why this mirrors the web app's loader.
 */

import * as Speech from 'expo-speech';

const RETRIES = 6;
const BACKOFF_MS = 400;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function loadVoices(): Promise<Speech.Voice[]> {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (voices.length) return voices;
    } catch {
      /* engine not ready yet */
    }
    await wait(BACKOFF_MS * (attempt + 1));
  }
  return [];
}

export const primaryTag = (lang: string | null | undefined): string =>
  String(lang || '').split(/[-_]/)[0].toLowerCase();

/** Human readable language name from the platform locale data, with the bare
 *  tag as fallback where Hermes lacks Intl.DisplayNames. */
export function languageName(lang: string, uiLang: string): string {
  const tag = primaryTag(lang);
  if (!tag) return lang || '';
  try {
    const DisplayNames = (Intl as unknown as {
      DisplayNames?: new (locales: string[], options: { type: 'language' }) => { of(tag: string): string | undefined };
    }).DisplayNames;
    if (DisplayNames) {
      const label = new DisplayNames([uiLang], { type: 'language' }).of(tag);
      if (label && label.toLowerCase() !== tag) return label;
    }
  } catch {
    /* unknown tag or missing Intl support */
  }
  return tag.toUpperCase();
}

/** Sorts voices so likely picks come first: preferred language tags, then by
 *  language, then enhanced quality, then name. */
export function sortVoices(voices: Speech.Voice[], preferredTags: string[]): Speech.Voice[] {
  const rank = (voice: Speech.Voice) => {
    const position = preferredTags.indexOf(primaryTag(voice.language));
    return position === -1 ? preferredTags.length : position;
  };

  return [...voices].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank) return byRank;
    const byLang = primaryTag(a.language).localeCompare(primaryTag(b.language));
    if (byLang) return byLang;
    const aEnhanced = a.quality === Speech.VoiceQuality.Enhanced;
    const bEnhanced = b.quality === Speech.VoiceQuality.Enhanced;
    if (aEnhanced !== bEnhanced) return aEnhanced ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export interface VoiceGroup {
  tag: string;
  label: string;
  voices: Speech.Voice[];
}

/** Groups a sorted voice list into language buckets. */
export function groupByLanguage(voices: Speech.Voice[], uiLang: string): VoiceGroup[] {
  const groups = new Map<string, VoiceGroup>();
  for (const voice of voices) {
    const tag = primaryTag(voice.language);
    let group = groups.get(tag);
    if (!group) {
      group = { tag, label: languageName(voice.language, uiLang), voices: [] };
      groups.set(tag, group);
    }
    group.voices.push(voice);
  }
  return [...groups.values()];
}

/** Best voice for a language tag: enhanced first, else the first match. */
export function pickForLanguage(voices: Speech.Voice[], tag: string): Speech.Voice | null {
  const matches = voices.filter((voice) => primaryTag(voice.language) === tag);
  if (!matches.length) return null;
  return matches.find((voice) => voice.quality === Speech.VoiceQuality.Enhanced) || matches[0];
}
