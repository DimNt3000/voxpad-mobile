/**
 * A chunk-chaining engine over expo-speech, the same architecture as the web
 * version of Voxpad wrapped around window.speechSynthesis. The platform
 * differences it hides from the UI:
 *
 *  - Android has no pause() or resume() at all (the underlying TextToSpeech
 *    API cannot pause). Pausing there means stopping the current utterance
 *    while keeping the cursor, and resuming restarts the current sentence.
 *    The web app needs the identical workaround on Android browsers.
 *  - stop() fires the stopped callback of the utterance it kills, which would
 *    otherwise look like normal completion and advance the cursor. Every
 *    utterance carries a generation token and stale callbacks are ignored.
 *  - Utterance settings are fixed once speak() is called, so changing voice,
 *    rate or pitch mid playback restarts the current sentence with the new
 *    settings.
 *  - Word boundary events exist on both platforms but not for every engine or
 *    voice. When they never arrive the UI simply stays at sentence highlight.
 */

import * as Speech from 'expo-speech';
import type { NativeBoundaryEvent } from 'expo-speech/build/Speech.types';
import { Platform } from 'react-native';
import { segment, type Chunk } from '../core/segmenter';

export type EngineState = 'idle' | 'speaking' | 'paused';

export interface EngineSettings {
  voiceId: string | null;
  language: string | null;
  rate: number;
  pitch: number;
  volume: number;
}

export interface EngineEvents {
  state: (state: EngineState) => void;
  /** index is -1 when nothing is active */
  sentence: (index: number) => void;
  boundary: (index: number, charIndex: number, charLength: number) => void;
  /** 0..1 across the whole text */
  progress: (ratio: number) => void;
  end: () => void;
  error: (message: string) => void;
}

const NATIVE_PAUSE = Platform.OS === 'ios';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export class SpeechEngine {
  chunks: Chunk[] = [];
  index = 0;
  state: EngineState = 'idle';

  private settings: EngineSettings = { voiceId: null, language: null, rate: 1, pitch: 1, volume: 1 };
  private token = 0;
  private offsets: number[] = [0];
  private totalChars = 0;
  private listeners: { [K in keyof EngineEvents]: Set<EngineEvents[K]> } = {
    state: new Set(),
    sentence: new Set(),
    boundary: new Set(),
    progress: new Set(),
    end: new Set(),
    error: new Set(),
  };

  on<K extends keyof EngineEvents>(event: K, fn: EngineEvents[K]): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  private emit<K extends keyof EngineEvents>(event: K, ...args: Parameters<EngineEvents[K]>): void {
    for (const fn of this.listeners[event]) (fn as (...a: unknown[]) => void)(...args);
  }

  get isBusy(): boolean {
    return this.state === 'speaking' || this.state === 'paused';
  }

  get sentenceCount(): number {
    return this.chunks.length;
  }

  /** Loads text and resets the cursor. */
  load(text: string): Chunk[] {
    this.stop();
    // Never exceed what the platform engine accepts in one utterance.
    const cap = Number.isFinite(Speech.maxSpeechInputLength)
      ? Math.min(180, Math.max(60, Speech.maxSpeechInputLength - 1))
      : 180;
    this.chunks = segment(text, cap);

    this.offsets = [0];
    let running = 0;
    for (const chunk of this.chunks) {
      running += chunk.text.length;
      this.offsets.push(running);
    }
    this.totalChars = running;
    this.index = 0;
    this.emit('progress', 0);
    return this.chunks;
  }

  /** Merges settings. Restarts the current sentence when already speaking. */
  applySettings(partial: Partial<EngineSettings>): void {
    Object.assign(this.settings, partial);
    if (this.state === 'speaking') this.play(this.index);
  }

  play(index: number = this.index): void {
    if (!this.chunks.length) return;
    this.index = clamp(index, 0, this.chunks.length - 1);
    this.token++;
    Speech.stop().catch(() => {});
    this.setState('speaking');
    this.speakCurrent();
  }

  pause(): void {
    if (this.state !== 'speaking') return;
    this.setState('paused');
    if (NATIVE_PAUSE) {
      Speech.pause().catch(() => {});
    } else {
      // Android cannot pause. Kill the utterance, keep the cursor: resume()
      // will restart the current sentence from its beginning.
      this.token++;
      Speech.stop().catch(() => {});
    }
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.setState('speaking');
    if (NATIVE_PAUSE) {
      Speech.resume().catch(() => {});
      // If the paused utterance had already finished (or died) there is
      // nothing to resume; restart the current sentence, like the web app.
      const token = this.token;
      setTimeout(() => {
        if (token !== this.token || this.state !== 'speaking') return;
        Speech.isSpeakingAsync()
          .then((speaking) => {
            if (!speaking && token === this.token && this.state === 'speaking') this.speakCurrent();
          })
          .catch(() => {});
      }, 250);
    } else {
      this.speakCurrent();
    }
  }

  toggle(): void {
    if (this.state === 'speaking') this.pause();
    else if (this.state === 'paused') this.resume();
    else this.play(this.index);
  }

  stop(): void {
    this.token++;
    Speech.stop().catch(() => {});
    this.index = 0;
    this.setState('idle');
    this.emit('sentence', -1);
    this.emit('progress', 0);
  }

  /** Moves by whole sentences, whether playing or not. */
  step(delta: number): void {
    if (!this.chunks.length) return;
    const target = clamp(this.index + delta, 0, this.chunks.length - 1);
    // Already at the boundary: stepping is a no-op, not a restart.
    if (target === this.index && this.state !== 'idle') return;
    if (this.state === 'idle') {
      this.index = target;
      this.emit('sentence', target);
      this.emit('progress', this.offsets[target] / (this.totalChars || 1));
    } else {
      this.play(target);
    }
  }

  /** Seeks by fraction of the whole text, snapping to a sentence start. */
  seekToRatio(ratio: number): void {
    if (!this.chunks.length) return;
    const target = clamp(ratio, 0, 1) * this.totalChars;
    let index = 0;
    while (index < this.chunks.length - 1 && this.offsets[index + 1] <= target) index++;

    if (this.state === 'idle') {
      this.index = index;
      this.emit('sentence', index);
      this.emit('progress', this.offsets[index] / (this.totalChars || 1));
    } else {
      this.play(index);
    }
  }

  /* ---------------------------------------------------------- internals -- */

  private speakCurrent(): void {
    const chunk = this.chunks[this.index];
    if (!chunk) {
      this.finish();
      return;
    }

    const token = ++this.token;
    const chunkIndex = this.index;
    const { voiceId, language, rate, pitch, volume } = this.settings;

    this.emit('sentence', chunkIndex);
    this.emit('progress', this.offsets[chunkIndex] / (this.totalChars || 1));

    Speech.speak(chunk.text, {
      voice: voiceId ?? undefined,
      language: voiceId ? undefined : language ?? undefined,
      rate: clamp(rate, 0.1, 2),
      pitch: clamp(pitch, 0.5, 2),
      volume: clamp(volume, 0, 1),

      onBoundary: (event: NativeBoundaryEvent) => {
        if (token !== this.token) return;
        const { charIndex, charLength } = event;
        if (charIndex == null || charIndex < 0 || !charLength) return;
        this.emit('boundary', chunkIndex, charIndex, charLength);
        this.emit('progress', (this.offsets[chunkIndex] + charIndex) / (this.totalChars || 1));
      },

      onDone: () => {
        if (token !== this.token) return;
        // A done callback racing a pause at a sentence boundary must not
        // advance while the user believes playback is paused; resume() will
        // pick the sentence back up.
        if (this.state === 'paused') return;
        if (this.index + 1 >= this.chunks.length) {
          this.finish();
        } else {
          this.index++;
          this.speakCurrent();
        }
      },

      // Fires for our own stop() as well; the token check filters those.
      onStopped: () => {
        if (token !== this.token) return;
        this.setState('idle');
      },

      onError: (error: Error) => {
        if (token !== this.token) return;
        // The error event goes out last, so UI handlers reacting to finish()
        // cannot overwrite the error message with a success message.
        this.finish();
        this.emit('error', error?.message || 'unknown');
      },
    });
  }

  private finish(): void {
    this.token++;
    this.setState('idle');
    this.emit('progress', 1);
    this.index = 0;
    this.emit('sentence', -1);
    this.emit('end');
  }

  private setState(state: EngineState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit('state', state);
  }
}
