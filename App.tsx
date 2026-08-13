/**
 * Voxpad: text to speech that runs on the device.
 *
 * This file is the controller. It wires the UI to the speech engine, the
 * segmenter and the stored preferences. The interesting parts live in
 * src/speech/engine.ts and src/core/segmenter.ts.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { File } from 'expo-file-system';
import type { Voice } from 'expo-speech';

import { SpeechEngine, type EngineState } from './src/speech/engine';
import { loadVoices, pickForLanguage, primaryTag, sortVoices } from './src/speech/voices';
import {
  countWords,
  detectScript,
  estimateSeconds,
  formatDuration,
  type Chunk,
} from './src/core/segmenter';
import { LANGUAGES, sampleText, scriptName, translate, type UiLanguage } from './src/core/i18n';
import {
  DEFAULT_PREFS,
  clearDraft,
  loadDraft,
  loadPrefs,
  saveDraft,
  savePrefs,
  type Prefs,
} from './src/core/prefs';
import { themeFor } from './src/theme';
import { ReaderPane, type WordRange } from './src/components/ReaderPane';
import { VoicePicker } from './src/components/VoicePicker';
import { DeliveryControls } from './src/components/DeliveryControls';
import { Transport } from './src/components/Transport';
import { Btn, Glyph } from './src/components/ui';

const MAX_FILE_BYTES = 1024 * 1024;
const TYPING_DELAY_MS = 300;

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const engine = useRef(new SpeechEngine()).current;
  const systemScheme = useColorScheme();

  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ ...DEFAULT_PREFS });
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [tab, setTab] = useState<'edit' | 'read'>('edit');

  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [word, setWord] = useState<WordRange | null>(null);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [clearArmed, setClearArmed] = useState(false);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uiLang: UiLanguage = prefs.lang ?? 'en';
  const scheme = prefs.theme ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const theme = themeFor(scheme);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(uiLang, key, vars),
    [uiLang]
  );

  /* ------------------------------------------------------------------ boot -- */

  useEffect(() => {
    let alive = true;
    (async () => {
      const [storedPrefs, draft] = await Promise.all([loadPrefs(), loadDraft()]);
      if (!alive) return;
      setPrefs(storedPrefs);
      engine.applySettings({
        rate: storedPrefs.rate,
        pitch: storedPrefs.pitch,
        volume: storedPrefs.volume,
      });
      if (draft) {
        setText(draft);
        setChunks(engine.load(draft));
      }
      setReady(true);

      const found = await loadVoices();
      if (!alive) return;
      const deviceTag = primaryTag(storedPrefs.lang ?? 'en');
      const sorted = sortVoices(found, [deviceTag]);
      setVoices(sorted);
      const saved = storedPrefs.voiceId
        ? sorted.find((v) => v.identifier === storedPrefs.voiceId) ?? null
        : null;
      const initial = saved ?? pickForLanguage(sorted, deviceTag) ?? sorted[0] ?? null;
      if (initial) {
        setVoice(initial);
        engine.applySettings({ voiceId: initial.identifier, language: initial.language });
      }
    })();
    return () => {
      alive = false;
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------------- engine -- */

  useEffect(() => {
    const offs = [
      engine.on('state', (state) => {
        setEngineState(state);
        setNotice(null);
      }),
      engine.on('sentence', (index) => {
        setActiveIndex(index);
        setWord(null);
      }),
      engine.on('boundary', (index, charIndex, charLength) => {
        setWord({ index, charIndex, charLength });
      }),
      engine.on('progress', setProgress),
      engine.on('end', () => setNotice(t('status.done'))),
      engine.on('error', (message) => setNotice(t('error.speech', { error: message }))),
    ];
    return () => offs.forEach((off) => off());
  }, [engine, t]);

  /* -------------------------------------------------------------- content -- */

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((old) => {
      const next = { ...old, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const applyText = useCallback(
    (value: string, { immediate = false }: { immediate?: boolean } = {}) => {
      setText(value);
      saveDraft(value);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      const run = () => setChunks(engine.load(value));
      if (immediate) run();
      else typingTimer.current = setTimeout(run, TYPING_DELAY_MS);
    },
    [engine]
  );

  const disarmClear = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setClearArmed(false);
  }, []);

  const onClear = useCallback(() => {
    if (!text) return;
    if (!clearArmed) {
      setClearArmed(true);
      clearTimer.current = setTimeout(() => setClearArmed(false), 3000);
      return;
    }
    disarmClear();
    engine.stop();
    clearDraft();
    applyText('', { immediate: true });
  }, [text, clearArmed, disarmClear, engine, applyText]);

  const onImport = useCallback(async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['text/plain', 'text/markdown'] });
      if (picked.canceled) return;
      const file = picked.result;
      if (file.size > MAX_FILE_BYTES) {
        setNotice(t('error.fileSize'));
        return;
      }
      applyText(await file.text(), { immediate: true });
      setTab('edit');
    } catch {
      setNotice(t('error.fileRead'));
    }
  }, [applyText, t]);

  /* --------------------------------------------------------------- voices -- */

  const selectVoice = useCallback(
    (next: Voice) => {
      setVoice(next);
      updatePrefs({ voiceId: next.identifier });
      engine.applySettings({ voiceId: next.identifier, language: next.language });
    },
    [engine, updatePrefs]
  );

  /** Suggests a matching voice when the text is in a non Latin script. */
  const suggestion = useMemo(() => {
    const detected = detectScript(text);
    if (!detected || !voice || !voices.length) return null;
    if (primaryTag(voice.language) === detected.lang) return null;
    const match = pickForLanguage(voices, detected.lang);
    return match ? { script: detected.script, voice: match } : null;
  }, [text, voice, voices]);

  /* ------------------------------------------------------------- delivery -- */

  const onDeliveryCommit = useCallback(
    (key: 'rate' | 'pitch' | 'volume', value: number) => {
      updatePrefs({ [key]: value });
      engine.applySettings({ [key]: value });
    },
    [engine, updatePrefs]
  );

  const onPreset = useCallback(
    (rate: number) => {
      updatePrefs({ rate });
      engine.applySettings({ rate });
    },
    [engine, updatePrefs]
  );

  const onReset = useCallback(() => {
    updatePrefs({ rate: 1, pitch: 1, volume: 1 });
    engine.applySettings({ rate: 1, pitch: 1, volume: 1 });
  }, [engine, updatePrefs]);

  /* ------------------------------------------------------------ transport -- */

  const onToggle = useCallback(() => {
    if (!chunks.length) return;
    if (engine.state === 'idle') setTab('read');
    engine.toggle();
  }, [chunks.length, engine]);

  const onSentencePress = useCallback(
    (index: number) => {
      engine.play(index);
    },
    [engine]
  );

  /* ----------------------------------------------------------------- text -- */

  const words = countWords(text);
  const meta = words
    ? t('meta.counts', { words, duration: formatDuration(estimateSeconds(words, prefs.rate)) })
    : t('meta.empty');

  const status =
    notice ??
    (!chunks.length
      ? t('status.empty')
      : engineState === 'speaking'
        ? t('status.speaking', { i: engine.index + 1, n: chunks.length })
        : engineState === 'paused'
          ? t('status.paused', { i: engine.index + 1, n: chunks.length })
          : t('status.ready', { n: chunks.length }));

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  /* ------------------------------------------------------------------- ui -- */

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {/* header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
            <View style={styles.wave}>
              {[8, 14, 20, 12, 6].map((h, i) => (
                <View key={i} style={[styles.waveBar, { height: h, backgroundColor: theme.accentInk }]} />
              ))}
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.brandName, { color: theme.ink }]}>Voxpad</Text>
            <Text numberOfLines={1} style={[styles.brandTag, { color: theme.inkSoft }]}>
              {t('tagline')}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <View style={[styles.seg, { borderColor: theme.lineStrong }]}>
            {LANGUAGES.map((lang) => {
              const active = lang === uiLang;
              return (
                <Pressable
                  key={lang}
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.language')}
                  accessibilityState={{ selected: active }}
                  onPress={() => updatePrefs({ lang })}
                  style={[styles.segBtn, { backgroundColor: active ? theme.ink : theme.surface }]}
                >
                  <Text style={{ color: active ? theme.bg : theme.inkSoft, fontSize: 13, fontWeight: '700' }}>
                    {lang.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Btn
            small
            theme={theme}
            label={t(scheme === 'dark' ? 'ui.light' : 'ui.dark')}
            accessibilityLabel={t('ui.theme')}
            onPress={() => updatePrefs({ theme: scheme === 'dark' ? 'light' : 'dark' })}
          />
        </View>
      </View>

      {/* tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.line }]}>
        {(['edit', 'read'] as const).map((name) => {
          const active = tab === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(name)}
              style={[styles.tab, { borderBottomColor: active ? theme.accent : 'transparent' }]}
            >
              <Text style={{ color: active ? theme.ink : theme.inkSoft, fontSize: 15, fontWeight: '600' }}>
                {t(`tab.${name}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* content */}
      {tab === 'read' ? (
        <ReaderPane
          text={text}
          chunks={chunks}
          activeIndex={activeIndex}
          word={word}
          onSentencePress={onSentencePress}
          theme={theme}
          emptyMessage={t('reader.empty')}
          hint={t('reader.hint')}
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.editWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.editScroll}
            contentContainerStyle={styles.editContent}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              multiline
              value={text}
              onChangeText={(value) => {
                disarmClear();
                applyText(value);
              }}
              placeholder={t('doc.placeholder')}
              placeholderTextColor={theme.inkFaint}
              textAlignVertical="top"
              style={[
                styles.editor,
                {
                  color: theme.ink,
                  backgroundColor: theme.bgSunk,
                  borderColor: theme.lineStrong,
                },
              ]}
            />

            <View style={styles.toolbar}>
              <Btn theme={theme} label={t('tool.import')} onPress={onImport} />
              <Btn theme={theme} label={t('tool.sample')} onPress={() => applyText(sampleText(uiLang), { immediate: true })} />
              <Btn
                theme={theme}
                accent={clearArmed}
                label={t(clearArmed ? 'tool.clearConfirm' : 'tool.clear')}
                onPress={onClear}
                disabled={!text}
              />
            </View>
            <Text style={[styles.meta, { color: theme.inkFaint }]}>{meta}</Text>

            {suggestion ? (
              <View style={[styles.hintBox, { backgroundColor: theme.accentWash }]}>
                <Text style={{ color: theme.ink, fontSize: 13, flex: 1 }}>
                  {t('voice.hint', { script: scriptName(uiLang, suggestion.script) })}
                </Text>
                <Btn small theme={theme} accent label={t('voice.useMatch')} onPress={() => selectVoice(suggestion.voice)} />
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: theme.inkFaint }]}>{t('voice.heading')}</Text>
            <VoicePicker
              voices={voices}
              selected={voice}
              onSelect={selectVoice}
              theme={theme}
              uiLang={uiLang}
              labels={{
                heading: t('voice.heading'),
                pick: t('voice.pick'),
                none: t('voice.none'),
                enhanced: t('voice.enhanced'),
                close: t('ui.close'),
                count: t('voice.count', { n: voices.length }),
              }}
            />

            <Text style={[styles.sectionTitle, { color: theme.inkFaint }]}>{t('delivery.heading')}</Text>
            <DeliveryControls
              rate={prefs.rate}
              pitch={prefs.pitch}
              volume={prefs.volume}
              onPreview={() => {}}
              onCommit={onDeliveryCommit}
              onPreset={onPreset}
              onReset={onReset}
              theme={theme}
              labels={{
                rate: t('delivery.rate'),
                pitch: t('delivery.pitch'),
                volume: t('delivery.volume'),
                slow: t('preset.slow'),
                normal: t('preset.normal'),
                brisk: t('preset.brisk'),
                reset: t('delivery.reset'),
              }}
            />

            <Text style={[styles.privacy, { color: theme.inkFaint }]}>{t('privacy.note')}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Transport
        state={engineState}
        hasText={chunks.length > 0}
        canPrev={chunks.length > 0 && engine.index > 0}
        canNext={chunks.length > 0 && engine.index < chunks.length - 1}
        progress={progress}
        status={status}
        onToggle={onToggle}
        onStop={() => engine.stop()}
        onStep={(delta) => engine.step(delta)}
        onSeek={(ratio) => {
          if (engine.state === 'idle') setTab('read');
          engine.seekToRatio(ratio);
        }}
        theme={theme}
        labels={{
          play: t('transport.play'),
          pause: t('transport.pause'),
          resume: t('transport.resume'),
          stop: t('transport.stop'),
          prev: t('transport.prev'),
          next: t('transport.next'),
          seek: t('transport.seek'),
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2.5 },
  waveBar: { width: 2.5, borderRadius: 1.5 },
  brandName: { fontSize: 18, fontWeight: '700' },
  brandTag: { fontSize: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  segBtn: { minHeight: 36, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, borderBottomWidth: 1 },
  tab: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderBottomWidth: 2,
  },
  editWrap: { flex: 1 },
  editScroll: { flex: 1 },
  editContent: { padding: 16, gap: 12 },
  editor: {
    minHeight: 170,
    maxHeight: 300,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    lineHeight: 26,
  },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { fontSize: 13, fontVariant: ['tabular-nums'] },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  privacy: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 12 },
});
