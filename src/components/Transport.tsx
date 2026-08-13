/**
 * The fixed bottom bar: sentence stepping, play/pause, stop, the seek slider
 * and the status line. Seeking is committed on release, like the web app.
 */

import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { RoundBtn } from './ui';
import type { EngineState } from '../speech/engine';
import type { Theme } from '../theme';

export function Transport(props: {
  state: EngineState;
  hasText: boolean;
  canPrev: boolean;
  canNext: boolean;
  progress: number;
  status: string;
  onToggle: () => void;
  onStop: () => void;
  onStep: (delta: number) => void;
  onSeek: (ratio: number) => void;
  theme: Theme;
  labels: { play: string; pause: string; resume: string; stop: string; prev: string; next: string; seek: string };
}) {
  const { state, hasText, theme, labels } = props;
  const [dragValue, setDragValue] = useState<number | null>(null);
  const dragging = useRef(false);

  const playLabel = state === 'speaking' ? labels.pause : state === 'paused' ? labels.resume : labels.play;

  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
      <View style={styles.buttons}>
        <RoundBtn
          glyph="prev"
          theme={theme}
          disabled={!props.canPrev}
          onPress={() => props.onStep(-1)}
          accessibilityLabel={labels.prev}
        />
        <RoundBtn
          glyph={state === 'speaking' ? 'pause' : 'play'}
          theme={theme}
          primary
          disabled={!hasText}
          onPress={props.onToggle}
          accessibilityLabel={playLabel}
        />
        <RoundBtn
          glyph="stop"
          theme={theme}
          disabled={state === 'idle'}
          onPress={props.onStop}
          accessibilityLabel={labels.stop}
        />
        <RoundBtn
          glyph="next"
          theme={theme}
          disabled={!props.canNext}
          onPress={() => props.onStep(1)}
          accessibilityLabel={labels.next}
        />
      </View>

      <Slider
        accessibilityLabel={labels.seek}
        minimumValue={0}
        maximumValue={1}
        value={dragging.current && dragValue !== null ? dragValue : props.progress}
        disabled={!hasText}
        onSlidingStart={() => {
          dragging.current = true;
        }}
        onValueChange={(v) => {
          if (dragging.current) setDragValue(v);
        }}
        onSlidingComplete={(v) => {
          dragging.current = false;
          setDragValue(null);
          props.onSeek(v);
        }}
        minimumTrackTintColor={theme.accent}
        maximumTrackTintColor={theme.line}
        thumbTintColor={theme.accent}
        style={styles.slider}
      />

      <Text accessibilityLiveRegion="polite" style={[styles.status, { color: theme.inkFaint }]}>
        {props.status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  slider: { width: '100%', height: 32, marginTop: 2 },
  status: { textAlign: 'center', fontSize: 12, paddingBottom: 6 },
});
