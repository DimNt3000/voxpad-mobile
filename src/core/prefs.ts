/**
 * Preferences and the draft text, in AsyncStorage.
 *
 * Same contract as the web version: two keys, both local to the device,
 * nothing sent anywhere. Storage failures are swallowed because losing a
 * preference is not worth interrupting playback for.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UiLanguage } from './i18n';

const PREFS_KEY = 'voxpad:prefs';
const DRAFT_KEY = 'voxpad:draft';
const SAVE_DELAY_MS = 400;
const MAX_DRAFT = 200_000;

export interface Prefs {
  /** null means follow the system setting */
  theme: 'light' | 'dark' | null;
  /** null means follow the device language */
  lang: UiLanguage | null;
  rate: number;
  pitch: number;
  volume: number;
  voiceId: string | null;
}

export const DEFAULT_PREFS: Prefs = {
  theme: null,
  lang: null,
  rate: 1,
  pitch: 1,
  volume: 1,
  voiceId: null,
};

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}

export async function loadDraft(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(DRAFT_KEY)) || '';
  } catch {
    return '';
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced so typing does not hit storage on every keystroke. */
export function saveDraft(text: string): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!text) clearDraft();
    else AsyncStorage.setItem(DRAFT_KEY, text.slice(0, MAX_DRAFT)).catch(() => {});
  }, SAVE_DELAY_MS);
}

export function clearDraft(): void {
  if (saveTimer) clearTimeout(saveTimer);
  AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
}
